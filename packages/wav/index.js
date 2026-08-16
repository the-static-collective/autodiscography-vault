import { open } from 'node:fs/promises';

export async function assertWavContainer(path) {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    const container = header.toString('ascii', 0, 4);
    const wave = header.toString('ascii', 8, 12);
    if (bytesRead < 12 || !['RIFF', 'RF64'].includes(container) || wave !== 'WAVE') {
      throw new Error('invalid WAV container');
    }
  } finally {
    await handle.close();
  }
}
