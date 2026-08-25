import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestCensusPack } from '../packages/census-ingest/index.js';

const FLAG_KEYS = new Map([
  ['input', 'inputPath'],
  ['vaultRoot', 'vaultRoot'],
  ['checkpointEvery', 'checkpointEvery'],
]);

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error('arguments must be --name value pairs');
    }
    const flagKey = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const optionKey = FLAG_KEYS.get(flagKey);
    if (!optionKey) throw new Error(`unknown argument: ${flag}`);
    options[optionKey] = value;
  }
  if (options.checkpointEvery !== undefined) {
    const parsed = Number(options.checkpointEvery);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new Error('checkpointEvery must be a positive integer');
    }
    options.checkpointEvery = parsed;
  }
  return options;
}

function output(result) {
  return {
    ...result,
    layers: {
      raw: {
        path: result.rawPath,
        sha256: result.rawSourceSha256,
        immutable: true,
      },
      normalized: {
        path: result.normalizedPath,
        normalizer: 'census-v1',
        reproducible: true,
      },
      derived: {
        status: 'not_built',
      },
    },
  };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const result = await ingestCensusPack(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(output(result), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`census:ingest refused: ${error?.message ?? 'unknown failure'}\n`);
    process.exitCode = 1;
  }
}

export { output as formatCensusResult, parseArgs as parseCensusArgs };
