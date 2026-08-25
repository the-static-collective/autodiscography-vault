const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:authorization|cookie|session|token|password|secret)\s*[:=])/i;
const SHA256_HEX = /^[a-f0-9]{64}$/;

function ps(value) {
  if (typeof value !== 'string' || !value || SECRET_VALUE.test(value)) {
    throw new Error('unsafe handoff value');
  }
  return `'${value.replaceAll("'", "''")}'`;
}

export function formatPowerShellAdmitCommand(input) {
  const parts = [
    'npm run pilot:admit --',
    `--staged-file ${ps(input?.stagedFile)}`,
    `--vault-root ${ps(input?.vaultRoot)}`,
    `--run-id ${ps(input?.runId)}`,
    `--provider-track-id ${ps(input?.providerTrackId)}`,
    `--asset-role ${ps(input?.assetRole)}`,
    `--observed-at ${ps(input?.observedAt)}`,
  ];

  if (input?.requestDescriptorSha256 !== undefined) {
    if (!SHA256_HEX.test(input.requestDescriptorSha256)) {
      throw new Error('unsafe handoff value');
    }
    parts.push(`--request-descriptor-sha256 ${ps(input.requestDescriptorSha256)}`);
  }

  return parts.join(' ');
}
