export function buildProposalConfirmationUrl(appUrl: string, proposalId: string) {
  const baseUrl = new URL(appUrl);
  return new URL(`/proposals/${encodeURIComponent(proposalId)}`, baseUrl).toString();
}
