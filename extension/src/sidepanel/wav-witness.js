const SUNO_ORIGINS = new Set(['https://suno.com', 'https://www.suno.com']);
const WAV_MIMES = new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']);

export function isWavDownloadItem(item) {
  const filename = typeof item?.filename === 'string' ? item.filename.toLowerCase() : '';
  const mime = typeof item?.mime === 'string' ? item.mime.toLowerCase() : '';
  return filename.endsWith('.wav') || WAV_MIMES.has(mime);
}

function referrerIsCompatible(referrer) {
  if (!referrer) return true;
  try {
    return SUNO_ORIGINS.has(new URL(referrer).origin);
  } catch {
    return false;
  }
}

export function bindCreatedWav({ arm, activeDownloadId = null, item } = {}) {
  if (!arm || !isWavDownloadItem(item)) return Object.freeze({ status: 'ignored' });

  const startedAtMs = Date.parse(item?.startTime ?? '');
  if (!Number.isFinite(startedAtMs) || startedAtMs < arm.armedAtMs) {
    return Object.freeze({ status: 'ignored' });
  }
  if (!referrerIsCompatible(item?.referrer)) return Object.freeze({ status: 'ignored' });
  if (!Number.isInteger(item?.id) || typeof item?.filename !== 'string' || !item.filename) {
    return Object.freeze({ status: 'ignored' });
  }
  if (activeDownloadId !== null) return Object.freeze({ status: 'ambiguous' });

  return Object.freeze({
    status: 'bound',
    downloadId: item.id,
    filename: item.filename,
    mime: typeof item.mime === 'string' ? item.mime : '',
  });
}
