import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

function element({ tagName, attributes = {}, textContent = '', children = [] } = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    tagName,
    textContent,
    href: attributes.href,
    src: attributes.src,
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
    matches(selector) {
      return selector === 'a[href]' && tagName === 'A' && attrs.has('href');
    },
    querySelector(selector) {
      if (selector === 'a[href]') return children.find(child => child.tagName === 'A' && child.getAttribute('href')) ?? null;
      if (selector.includes('title')) return children.find(child => child.getAttribute('data-testid') === 'title') ?? null;
      return null;
    },
    querySelectorAll() {
      return children.filter(child => ['AUDIO', 'SOURCE', 'IMG', 'A'].includes(child.tagName));
    },
  };
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

test('duplicate provider witnesses aggregate richer title and visible asset surfaces before capping', () => {
  const observer = loadObserver();
  const songUrl = 'https://suno.com/song/track-alpha';
  const sparseAnchor = element({ tagName: 'A', attributes: { href: songUrl } });
  const sparse = element({
    tagName: 'DIV',
    attributes: { 'data-song-id': 'track-alpha' },
    children: [sparseAnchor],
  });

  const richAnchor = element({ tagName: 'A', attributes: { href: songUrl }, textContent: 'A Real Title' });
  const audioUrl = 'https://cdn.example.test/track-alpha.mp3?token=ephemeral-secret#player';
  const imageUrl = 'https://img.example.test/track-alpha.jpg?sig=ephemeral-secret';
  const rich = element({
    tagName: 'DIV',
    attributes: { 'data-song-id': 'track-alpha', 'data-title': 'A Real Title' },
    children: [
      richAnchor,
      element({ tagName: 'AUDIO', attributes: { src: audioUrl, type: 'audio/mpeg' } }),
      element({ tagName: 'IMG', attributes: { src: imageUrl } }),
    ],
  });

  const documentLike = {
    querySelectorAll() {
      return [sparse, rich];
    },
  };

  const extracted = observer.extractSunoCandidates(documentLike);
  assert.equal(extracted.candidateNodeCount, 2);
  assert.equal(extracted.candidates.length, 1);
  assert.equal(extracted.candidates[0].providerTrackId, 'track-alpha');
  assert.equal(extracted.candidates[0].title, 'A Real Title');
  assert.equal(extracted.candidates[0].observedAssets.length, 2);

  const audio = extracted.candidates[0].observedAssets.find(asset => asset.assetRole === 'audio_mp3');
  assert.equal(audio.transportUrl, audioUrl);
  assert.equal(audio.requestPreview, 'GET https://cdn.example.test/track-alpha.mp3\nprovider=suno\ntrack=track-alpha\nasset=audio_mp3');
  assert.equal(audio.requestPreview.includes('ephemeral-secret'), false);
  assert.equal(
    audio.requestDescriptorSha256,
    createHash('sha256').update(audio.requestPreview, 'utf8').digest('hex'),
  );

  const observation = observer.buildLiveObservation({
    origin: 'https://suno.com',
    candidates: extracted.candidates,
    candidateNodeCount: extracted.candidateNodeCount,
    observedAt: '2026-08-15T19:00:00.000Z',
  });
  assert.equal(observation.status, 'ready');
  assert.equal(observation.tracks[0].title, 'A Real Title');
  assert.equal(observation.tracks[0].observedAssets.length, 2);
});

test('aggregation happens before the 25-track cap', () => {
  const observer = loadObserver();
  const nodes = [];
  for (let index = 1; index <= 25; index += 1) {
    nodes.push(element({
      tagName: 'A',
      attributes: { href: `https://suno.com/song/track-${index}`, 'data-song-id': `track-${index}` },
      textContent: index === 1 ? '' : `Track ${index}`,
    }));
  }
  nodes.push(element({
    tagName: 'A',
    attributes: { href: 'https://suno.com/song/track-1', 'data-song-id': 'track-1', 'data-title': 'Track One Enriched' },
    textContent: 'Track One Enriched',
  }));

  const extracted = observer.extractSunoCandidates({ querySelectorAll: () => nodes });
  assert.equal(extracted.candidateNodeCount, 26);
  assert.equal(extracted.candidates.length, 25);
  assert.equal(extracted.candidates[0].title, 'Track One Enriched');
});

test('WAV is proposed and explicit audio/wav surfaces classify as audio_wav', () => {
  const observer = loadObserver();
  const wavUrl = 'https://cdn.example.test/track-wav.wav?sig=ephemeral-secret#download';
  const node = element({
    tagName: 'DIV',
    attributes: { 'data-song-id': 'track-wav', 'data-title': 'WAV Track' },
    children: [
      element({ tagName: 'A', attributes: { href: 'https://suno.com/song/track-wav' } }),
      element({ tagName: 'SOURCE', attributes: { src: wavUrl, type: 'audio/wav' } }),
    ],
  });

  const extracted = observer.extractSunoCandidates({ querySelectorAll: () => [node] });
  const observation = observer.buildLiveObservation({
    origin: 'https://suno.com',
    candidates: extracted.candidates,
    candidateNodeCount: extracted.candidateNodeCount,
    observedAt: '2026-08-15T21:00:00.000Z',
  });

  assert.equal(observation.tracks[0].proposedAssets.includes('audio_wav'), true);
  const wav = observation.tracks[0].observedAssets.find(asset => asset.assetRole === 'audio_wav');
  assert.ok(wav);
  assert.equal(wav.transportUrl, wavUrl);
  assert.equal(wav.requestPreview.includes('ephemeral-secret'), false);
  assert.match(wav.requestPreview, /asset=audio_wav$/);
});

test('WAV link classifies as audio_wav while unknown audio remains other', () => {
  const observer = loadObserver();
  const node = element({
    tagName: 'DIV',
    attributes: { 'data-song-id': 'track-wav-link' },
    children: [
      element({ tagName: 'A', attributes: { href: 'https://suno.com/song/track-wav-link' } }),
      element({ tagName: 'A', attributes: { href: 'https://cdn.example.test/master.wav?sig=ephemeral' } }),
      element({ tagName: 'SOURCE', attributes: { src: 'https://cdn.example.test/master.aac', type: 'audio/aac' } }),
    ],
  });

  const extracted = observer.extractSunoCandidates({ querySelectorAll: () => [node] });
  assert.equal(extracted.candidates[0].observedAssets.some(asset => asset.assetRole === 'audio_wav'), true);
  assert.equal(extracted.candidates[0].observedAssets.some(asset => asset.assetRole === 'other'), true);
});
