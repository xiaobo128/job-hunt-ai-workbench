export function buildProposalConfirmationUrl(appUrl: string, proposalId: string) {
  const baseUrl = new URL(appUrl);
  return new URL(`/proposals/${encodeURIComponent(proposalId)}`, baseUrl).toString();
}

export function requireProposalConfirmationAppUrl(appUrl: string | null) {
  if (!appUrl) throw new ProposalConfirmationConfigurationError("APP_URL_REQUIRED");
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("invalid protocol");
    return appUrl;
  } catch {
    throw new ProposalConfirmationConfigurationError("APP_URL_INVALID");
  }
}

export class ProposalConfirmationConfigurationError extends Error {
  constructor(public readonly code: "APP_URL_REQUIRED" | "APP_URL_INVALID") {
    super(code);
    this.name = "ProposalConfirmationConfigurationError";
  }
}

export async function createConfirmableProposal<T extends { proposalId: string }>({
  appUrl,
  createProposal
}: {
  appUrl: string | null;
  createProposal: () => Promise<T>;
}) {
  const configuredAppUrl = requireProposalConfirmationAppUrl(appUrl);
  const proposal = await createProposal();
  return {
    ...proposal,
    confirmationUrl: buildProposalConfirmationUrl(configuredAppUrl, proposal.proposalId)
  };
}
