/**
 * Locates an extracted value in the original notification body. Only whitespace
 * may differ; the returned value is always the source slice, never model text.
 */
export function locateSourceExcerpt(content: string, candidate: string | null | undefined) {
  const trimmed = candidate?.trim();
  if (!trimmed) return null;

  const exactIndex = content.indexOf(trimmed);
  if (exactIndex >= 0) return content.slice(exactIndex, exactIndex + trimmed.length);

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const matcher = new RegExp(tokens.map(escapeRegExp).join("\\s+"));
  const match = matcher.exec(content);
  return match?.[0]?.trim() || null;
}

export function validateSourceExcerpts(content: string, candidates: readonly string[] | null | undefined) {
  if (!candidates?.length) return null;

  const excerpts: string[] = [];
  for (const candidate of candidates) {
    const excerpt = locateSourceExcerpt(content, candidate);
    if (excerpt && !excerpts.includes(excerpt)) excerpts.push(excerpt);
  }
  return excerpts.length ? excerpts : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
