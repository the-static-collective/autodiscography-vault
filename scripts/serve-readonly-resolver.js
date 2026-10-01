import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseAddress,
  ResolverError,
  resolveVerifiedAudio,
  resolveVerifiedAudioForServe,
} from '../packages/resolver/index.js';

function json(response, status, value, origin = null) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.byteLength,
    'Cache-Control': 'no-store',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  });
  response.end(body);
}

function parseArgs(argv) {
  const options = {
    port: 13703,
    host: '127.0.0.1',
    roomOrigin: 'http://127.0.0.1:13702',
    vaultRoot: null,
  };

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error('arguments must be --name value pairs');
    }
    const key = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[key] = value;
  }

  const port = Number(options.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port must be 1-65535');
  }
  if (options.host !== '127.0.0.1') {
    throw new Error('read-only resolver binds only to 127.0.0.1');
  }
  if (typeof options.vaultRoot !== 'string' || options.vaultRoot.length === 0) {
    throw new Error('--vault-root is required');
  }

  let roomOrigin;
  try {
    const parsed = new URL(options.roomOrigin);
    if (
      parsed.protocol !== 'http:'
      || !['127.0.0.1', 'localhost'].includes(parsed.hostname)
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) {
      throw new Error();
    }
    roomOrigin = parsed.origin;
  } catch {
    throw new Error('--room-origin must be a plain loopback http origin');
  }

  return Object.freeze({
    port,
    host: '127.0.0.1',
    roomOrigin,
    vaultRoot: resolve(options.vaultRoot),
  });
}

function requestedOrigin(request, allowedOrigin) {
  const origin = request.headers.origin;
  return origin === allowedOrigin ? allowedOrigin : null;
}

function parseRange(header, length) {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) throw new ResolverError('INVALID_RANGE', 'Only one byte range is supported.', 416);

  let start;
  let end;

  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      throw new ResolverError('INVALID_RANGE', 'Invalid byte range.', 416);
    }
    start = Math.max(0, length - suffix);
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? length - 1 : Number(match[2]);
  }

  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= length
  ) {
    throw new ResolverError('INVALID_RANGE', 'Requested byte range is unsatisfiable.', 416);
  }

  end = Math.min(end, length - 1);
  return { start, end };
}

export function createResolverServer(options) {
  const { vaultRoot, roomOrigin } = options;

  return createServer(async (request, response) => {
    const host = request.headers.host ?? '';
    const expectedHosts = new Set([
      `127.0.0.1:${options.port}`,
      `localhost:${options.port}`,
    ]);

    if (!expectedHosts.has(host)) {
      json(response, 403, { code: 'HOST_REFUSED', detail: 'Loopback Host header required.' });
      return;
    }

    const origin = requestedOrigin(request, roomOrigin);
    if (request.headers.origin !== undefined && origin === null) {
      json(response, 403, { code: 'ORIGIN_REFUSED', detail: 'Origin is not the configured local Room.' });
      return;
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': roomOrigin,
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Max-Age': '300',
        Vary: 'Origin',
      });
      response.end();
      return;
    }

    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      json(response, 405, { code: 'METHOD_REFUSED', detail: 'Resolver is read-only.' }, origin);
      return;
    }

    let url;
    try {
      url = new URL(request.url ?? '/', `http://${host}`);
    } catch {
      json(response, 400, { code: 'BAD_URL', detail: 'Malformed request URL.' }, origin);
      return;
    }

    try {
      if (url.pathname === '/v0/status') {
        json(response, 200, {
          schema: 'autodiscography-vault-resolver-status/v0',
          status: 'ready',
          authority: 'none',
          transport: 'loopback-read-only',
        }, origin);
        return;
      }

      const resolveMatch = /^\/v0\/resolve\/([a-f0-9]{64})$/.exec(url.pathname);
      if (resolveMatch) {
        const address = `sha256:${resolveMatch[1]}`;
        parseAddress(address);
        const descriptor = await resolveVerifiedAudio(vaultRoot, address);
        json(response, 200, descriptor, origin);
        return;
      }

      const mediaMatch = /^\/v0\/media\/([a-f0-9]{64})$/.exec(url.pathname);
      if (mediaMatch) {
        const address = `sha256:${mediaMatch[1]}`;
        const resolved = await resolveVerifiedAudioForServe(vaultRoot, address);
        const length = resolved.descriptor.byteLength;
        const range = parseRange(request.headers.range, length);

        const headers = {
          'Content-Type': resolved.descriptor.mediaType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
          'X-Content-SHA256': resolved.descriptor.sha256,
          ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
        };

        if (range) {
          const size = range.end - range.start + 1;
          response.writeHead(206, {
            ...headers,
            'Content-Length': size,
            'Content-Range': `bytes ${range.start}-${range.end}/${length}`,
          });
          if (request.method === 'HEAD') return response.end();
          createReadStream(resolved.filePath, { start: range.start, end: range.end }).pipe(response);
          return;
        }

        response.writeHead(200, { ...headers, 'Content-Length': length });
        if (request.method === 'HEAD') return response.end();
        createReadStream(resolved.filePath).pipe(response);
        return;
      }

      json(response, 404, { code: 'NOT_FOUND', detail: 'No such resolver endpoint.' }, origin);
    } catch (error) {
      if (error instanceof ResolverError) {
        json(response, error.status, { code: error.code, detail: error.message }, origin);
        return;
      }
      json(response, 500, { code: 'RESOLVER_FAILURE', detail: 'Resolver failed closed.' }, origin);
    }
  });
}

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isCli) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const server = createResolverServer(options);
    server.listen(options.port, options.host, () => {
      process.stdout.write(
        `Autodiscography Vault resolver: http://127.0.0.1:${options.port} (read-only)\n`,
      );
    });
  } catch (error) {
    process.stderr.write(`resolver refused: ${error?.message ?? 'unknown failure'}\n`);
    process.exitCode = 1;
  }
}
