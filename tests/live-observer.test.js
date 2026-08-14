import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadObserver() {
  const url = new URL('../extension/src/provider/suno/live-observer.js', import.meta.url);
  assert.equal(existsSync(url), true, 'Phase B1 live observer must exist');
  const source = readFileSync(url, 'utf8');
  const context = { URL, console };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'live-observer.js' });
  assert.equal(typeof context.AutodiscographyVaultSuno?.buildLiveObservation, 'function');
  return context.AutodiscographyVaultSuno;
}

test('wrong origin refuses before candidate processing', () => {
  const observer = loadObserver();
  const result = observer.buildLiveObservation({
    origin: 'https://example.com',
    candidates: [{ providerTrackId: 'should-not-pass' }],
    observedAt: '2026-08-14T17:00:00.000Z',
  });
  assert.equal(result.status, 'refused');
  assert.equal(result.reasonCode, 'wrong_origin');
  assert.equal(result.tracks.length, 0);
});

test('live observation is deterministically capped at 25 tracks', () => {
  const observer = loadObserver();
  const candidates = Array.from({ length: 30 }, (_, index) => ({
    providerTrackId: `track-${index + 1}`,
    title: `Track ${index + 1}`,
    sourceUrl: `https://suno.com/song/track-${index + 1}`,
  }));
  const result = observer.buildLiveObservation({
    origin: 'https://suno.com',
    candidates,
    observedAt: '2026-08-14T17:00:00.000Z',
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.tracks.length, 25);
  assert.equal(result.tracks[0].providerTrackId, 'track-1');
  assert.equal(result.tracks[24].providerTrackId, 'track-25');
  assert.equal(result.truncated, true);
  assert.equal(result.warningReasonCode, 'pilot_cap_reached');
});

test('missing provider ID remains explicit null', () => {
  const observer = loadObserver();
  const result = observer.buildLiveObservation({
    origin: 'https://www.suno.com',
    candidates: [{ title: 'Visible title only', sourceUrl: 'https://www.suno.com/library' }],
    observedAt: '2026-08-14T17:00:00.000Z',
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.tracks[0].providerTrackId, null);
  assert.equal(result.tracks[0].title, 'Visible title only');
});

test('secret-shaped evidence refuses without echoing the value', () => {
  const observer = loadObserver();
  const secret = 'Bearer abcdef-super-sensitive';
  const result = observer.buildLiveObservation({
    origin: 'https://suno.com',
    candidates: [{
      providerTrackId: 'track-safe-id',
      title: 'Track',
      evidence: { authorization: secret },
    }],
    observedAt: '2026-08-14T17:00:00.000Z',
  });
  assert.equal(result.status, 'refused');
  assert.equal(result.reasonCode, 'reusable_auth_required');
  assert.equal(JSON.stringify(result).includes(secret), false);
});
