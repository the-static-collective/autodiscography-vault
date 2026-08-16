import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCreatedWav, isWavDownloadItem } from '../extension/src/sidepanel/wav-witness.js';

const arm = Object.freeze({
  runId: 'suno-b2c-test',
  providerTrackId: 'track-alpha',
  observedAt: '2026-08-15T21:00:00.000Z',
  armedAtMs: Date.parse('2026-08-15T21:00:01.000Z'),
});

function item(overrides = {}) {
  return {
    id: 41,
    filename: 'C:\\Users\\Example\\Downloads\\song.wav',
    mime: 'audio/wav',
    startTime: '2026-08-15T21:00:02.000Z',
    referrer: 'https://suno.com/song/track-alpha',
    url: 'https://cdn.example.test/song.wav?sig=secret',
    finalUrl: 'https://cdn.example.test/song.wav?sig=secret2',
    ...overrides,
  };
}

test('WAV evidence accepts filename or MIME', () => {
  assert.equal(isWavDownloadItem(item({ mime: '' })), true);
  assert.equal(isWavDownloadItem(item({ filename: 'C:\\tmp\\download.bin', mime: 'audio/wav' })), true);
  assert.equal(isWavDownloadItem(item({ filename: 'C:\\tmp\\song.mp3', mime: 'audio/mpeg' })), false);
});

test('unarmed, historical, non-WAV, and explicit non-Suno referrer downloads are ignored', () => {
  assert.deepEqual(bindCreatedWav({ arm: null, item: item() }), { status: 'ignored' });
  assert.deepEqual(bindCreatedWav({ arm, item: item({ startTime: '2026-08-15T20:59:59.000Z' }) }), { status: 'ignored' });
  assert.deepEqual(bindCreatedWav({ arm, item: item({ filename: 'C:\\tmp\\song.mp3', mime: 'audio/mpeg' }) }), { status: 'ignored' });
  assert.deepEqual(bindCreatedWav({ arm, item: item({ referrer: 'https://example.com/not-suno' }) }), { status: 'ignored' });
});

test('fresh WAV with absent referrer may bind and URL capability is not returned', () => {
  const result = bindCreatedWav({ arm, item: item({ referrer: '' }) });
  assert.equal(result.status, 'bound');
  assert.equal(result.downloadId, 41);
  assert.equal(result.filename.endsWith('song.wav'), true);
  assert.equal('url' in result, false);
  assert.equal('finalUrl' in result, false);
  assert.equal('referrer' in result, false);
});

test('second matching WAV while one is already bound fails closed as ambiguous', () => {
  const result = bindCreatedWav({ arm, activeDownloadId: 40, item: item({ id: 42 }) });
  assert.deepEqual(result, { status: 'ambiguous' });
});
