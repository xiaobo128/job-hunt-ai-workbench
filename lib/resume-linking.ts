export const INITIAL_RESUME_LINK_VARIANT_NOTE = "__INITIAL_RESUME_LINK__";

export function isInitialResumeLinkVariant(note: string | null | undefined) {
  return (note || "").trim() === INITIAL_RESUME_LINK_VARIANT_NOTE;
}
