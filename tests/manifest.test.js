import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHandoffManifest } from '../packages/manifest/index.js';

test('handoff keeps raw metadata reference separate from derived asset record', () => {
  const manifest = buildHandoffManifest({
    runId: 'r1',
    receipts: [{
      schemaVersion: 1,
      runId: 'r1',
      provider: 'suno',
      providerTrackId: 't1',
      assetRole: 'audio_mp3',
      state: 'verified',
      observedAt: '2026-08-12T00:00:00.000Z',
      sourceRelativePath: 'assets/t1.mp3',
      byteLength: 3,
      sha256: 'a'.repeat(64),
      rawMetadataPath: 'raw/library.json',
      rawMetadataSha256: 'b'.repeat(64),
      requestDescriptorSha256: 'c'.repeat(64),
    }],
  });

  assert.equal(manifest.schema, 'autodiscography-vault-handoff/v0');
  assert.equal(manifest.records[0].rawMetadata.path, 'raw/library.json');
  assert.equal(manifest.records[0].rawMetadata.sha256, 'b'.repeat(64));
  assert.equal(manifest.records[0].asset.sha256, 'a'.repeat(64));
  assert.equal(manifest.records[0].providerTrackId, 't1');
  assert.equal(manifest.records[0].requestDescriptorSha256, 'c'.repeat(64));
  assert.equal(JSON.stringify(manifest).includes('transportUrl'), false);
});

test('handoff preserves explicit incomplete state rather than inventing bytes', () => {
  const manifest = buildHandoffManifest({
    runId: 'r1',
    receipts: [{
      schemaVersion: 1,
      runId: 'r1',
      provider: 'suno',
      providerTrackId: 't1',
      assetRole: 'lyrics',
      state: 'missing',
      observedAt: '2026-08-12T00:00:00.000Z',
      reasonCode: 'not_available',
    }],
  });

  assert.equal(manifest.records[0].state, 'missing');
  assert.equal(manifest.records[0].asset.byteLength, null);
  assert.equal(manifest.records[0].asset.sha256, null);
  assert.equal(manifest.records[0].reasonCode, 'not_available');
  assert.equal(manifest.records[0].requestDescriptorSha256, null);
});
