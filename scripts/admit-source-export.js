/** Suno source-export custody. Local-only; no APIs, browser, network, or lineage inference. */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const FORMATS = new Set(['.json', '.jsonl', '.ndjson', '.csv', '.tsv', '.zip']);
const SOURCES = new Set(['operator-supplied', 'claimed-suno-account-export']);
const MAX_BYTES = 1024 * 1024 * 1024;
function fail(code) { throw new Error('source-export refused: ' + code); }
function under(path, parent) {
  const r = relative(parent, path);
  return r === '' || (!r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r));
}
async function digestFile(path) {
  const h = createHash('sha256'); let length = 0;
  for await (const chunk of createReadStream(path)) {
    length += chunk.length; if (length > MAX_BYTES) fail('file_too_large');
    h.update(chunk);
  }
  return { sha256: h.digest('hex'), byteLength: length };
}
function safeJournal(text) {
  if (text && !text.endsWith('\n')) fail('truncated_journal');
  const entries = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    let parsed; try { parsed = JSON.parse(line); } catch { fail('invalid_journal'); }
    if (typeof parsed.sha256 !== 'string' || typeof parsed.byteLength !== 'number') fail('malformed_receipt');
    entries.push(parsed);
  }
  return entries;
}
async function verify(path, expected) {
  let found;
  try { found = await digestFile(path); }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
  if (found.sha256 !== expected.sha256 || found.byteLength !== expected.byteLength) fail('existing_bytes_mismatch');
  return true;
}
export async function admitSourceExport({ input, vaultRoot, sourceClaim = 'operator-supplied' }) {
  if (typeof input !== 'string' || typeof vaultRoot !== 'string' || !input || !vaultRoot)
    fail('local_input_and_vault_required');
  if (!SOURCES.has(sourceClaim)) fail('unknown_source_claim');
  const src = resolve(input), root = resolve(vaultRoot);
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (root === dirname(root) || under(root, repoRoot)) fail('vault_must_be_outside_repository');
  if (under(src, root)) fail('input_must_be_outside_vault');
  const extension = extname(src).toLowerCase();
  if (!FORMATS.has(extension)) fail('unsupported_input_format');
  const st = await lstat(src);
  if (!st.isFile() || st.size === 0 || st.size > MAX_BYTES) fail('invalid_input_file');
  // The source path, filename and private creative content are never emitted into receipts.
  const claimed = await digestFile(src);
  if (!claimed.byteLength) fail('empty_input');
  const rel = join('source-exports', 'suno', claimed.sha256 + extension);
  const dest = join(root, rel), journalPath = join(root, 'receipts', 'source-exports.jsonl');
  await mkdir(dirname(dest), { recursive: true, mode: 0o700 });
  await mkdir(dirname(journalPath), { recursive: true, mode: 0o700 });
  const lockPath = journalPath + '.lock';
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') fail('concurrent_admission_or_stale_lock'); throw e; }
  try {
    let history = '';
    try { history = await readFile(journalPath, 'utf8'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const existing = safeJournal(history).find(e => e.sha256 === claimed.sha256);
    if (existing) {
      if (existing.byteLength !== claimed.byteLength ||
          !await verify(join(root, existing.relativePath), claimed)) fail('prior_receipt_unverifiable');
      return { skippedExistingVerified: true, receipt: existing };
    }
    if (!await verify(dest, claimed)) {
      const partial = dest + '.partial';
      const file = await open(partial, 'wx', 0o600);
      try {
        await pipeline(createReadStream(src), createWriteStream('', { fd: file.fd, autoClose: false }));
        await file.sync();
      } finally { await file.close(); }
      if (!await verify(partial, claimed)) fail('copy_failed_verification');
      await rename(partial, dest);
    }
    const receipt = {
      schema: 'autodiscography-source-export-custody/v1',
      provider: 'suno', sourceClaim, sourceAuthenticated: false,
      status: 'source_bytes_verified_only', sha256: claimed.sha256,
      byteLength: claimed.byteLength, format: extension.slice(1),
      relativePath: rel.split(sep).join('/'), admittedAt: new Date().toISOString(),
      contentsInspected: false, recordCount: null, oldestCreatedAt: null,
      newestCreatedAt: null, lineageVerified: false,
    };
    const journal = await open(journalPath, 'a', 0o600);
    try { await journal.writeFile(JSON.stringify(receipt) + '\n'); await journal.sync(); }
    finally { await journal.close(); }
    await verify(dest, claimed);
    return { skippedExistingVerified: false, receipt };
  } finally { await lock.close(); await unlink(lockPath); }
}
function parseArgs(argv) {
  const args = {};
  if (argv.length % 2) fail('usage');
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--input', '--vault-root', '--source-claim'].includes(argv[i])) fail('usage');
    const key = { '--input': 'input', '--vault-root': 'vaultRoot', '--source-claim': 'sourceClaim' }[argv[i]];
    if (key in args) fail('duplicate_option');
    args[key] = argv[i + 1];
  }
  if (!args.input || !args.vaultRoot) fail('usage');
  return args;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await admitSourceExport(parseArgs(process.argv.slice(2))), null, 2) + '\n'); }
  catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 1; }
}
