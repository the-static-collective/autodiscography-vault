import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertWavContainer } from '../packages/wav/index.js';

async function staged(bytes, name = 'specimen.wav') {
  const root = await mkdtemp(join(tmpdir(), 'vault-wav-'));
  const path = join(root, name);
  await writeFile(path, bytes);
  return path;
}

function waveHeader(container) {
  return Buffer.concat([Buffer.from(container, 'ascii'), Buffer.alloc(4), Buffer.from('WAVE', 'ascii')]);
}

test('RIFF/WAVE and RF64/WAVE headers pass the bounded container sanity gate', async () => {
  await assert.doesNotReject(() => assertWavContainer(await staged(waveHeader('RIFF'), 'riff.wav')));
  await assert.doesNotReject(() => assertWavContainer(await staged(waveHeader('RF64'), 'rf64.wav')));
});

test('obvious non-WAV bytes are refused', async () => {
  const path = await staged(Buffer.from('not-wave-data', 'utf8'));
  await assert.rejects(() => assertWavContainer(path), /invalid WAV container/);
});
