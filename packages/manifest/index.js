import { validateReceipt } from '../acquisition-contract/index.js';

export function buildHandoffManifest({ runId, receipts }) {
  if (typeof runId !== 'string' || runId.length === 0) throw new Error('runId is required');
  if (!Array.isArray(receipts)) throw new Error('receipts must be an array');

  const validated = receipts.map(validateReceipt);
  for (const receipt of validated) {
    if (receipt.runId !== runId) throw new Error('receipt runId does not match manifest runId');
  }

  return Object.freeze({
    schema: 'autodiscography-vault-handoff/v0',
    runId,
    records: validated.map(receipt => Object.freeze({
      provider: receipt.provider,
      providerTrackId: receipt.providerTrackId,
      observedAt: receipt.observedAt,
      state: receipt.state,
      reasonCode: receipt.reasonCode ?? null,
      requestDescriptorSha256: receipt.requestDescriptorSha256 ?? null,
      asset: Object.freeze({
        role: receipt.assetRole,
        path: receipt.sourceRelativePath ?? null,
        byteLength: receipt.byteLength ?? null,
        sha256: receipt.sha256 ?? null,
      }),
      rawMetadata: receipt.rawMetadataPath
        ? Object.freeze({
            path: receipt.rawMetadataPath,
            sha256: receipt.rawMetadataSha256 ?? null,
          })
        : null,
    })),
  });
}
