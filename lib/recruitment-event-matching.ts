import type { RecruitmentEventExtraction } from "@/lib/ai";

export type RecruitmentApplicationCandidate = {
  applicationId: string;
  companyName: string;
  roleTitle: string;
  city?: string | null;
};

export type RecruitmentMatchConfidence = "HIGH" | "MEDIUM" | "LOW";

export type RecruitmentApplicationMatch = {
  applicationId: string;
  companyName: string;
  roleTitle: string;
  score: number;
  confidence: RecruitmentMatchConfidence;
  reasons: string[];
};

/**
 * Scores existing application candidates using only explicit extraction hints.
 * It never reads persistence or chooses an application on behalf of a caller.
 */
export function matchRecruitmentEventToApplications(
  extraction: RecruitmentEventExtraction,
  candidates: readonly RecruitmentApplicationCandidate[]
): RecruitmentApplicationMatch[] {
  const companyHint = normalizeCompanyName(extraction.companyHint);
  const roleHint = normalizeComparableText(extraction.roleHint);
  const addressHint = normalizeCityText(extraction.offlineAddress);

  if (!companyHint && !roleHint) {
    return [];
  }

  return candidates
    .map((candidate) => {
      const companySimilarity = companyHint
        ? companyNameSimilarity(companyHint, normalizeCompanyName(candidate.companyName))
        : 0;
      const roleSimilarity = roleHint
        ? tokenOverlap(roleTokens(roleHint), roleTokens(normalizeComparableText(candidate.roleTitle)))
        : 0;
      const cityMatch = addressHint && candidate.city
        ? cityAppearsInAddress(normalizeCityText(candidate.city), addressHint)
        : false;
      const score = Math.round(companySimilarity * 70 + roleSimilarity * 25 + (cityMatch ? 5 : 0));
      const reasons = matchingReasons({ companySimilarity, roleSimilarity, cityMatch, candidate });

      return {
        applicationId: candidate.applicationId,
        companyName: candidate.companyName,
        roleTitle: candidate.roleTitle,
        score,
        confidence: matchConfidence({ companySimilarity, roleSimilarity, cityMatch, score }),
        reasons
      };
    })
    .filter((match) => match.score >= 20)
    .sort((left, right) => right.score - left.score || left.applicationId.localeCompare(right.applicationId));
}

function matchConfidence({
  companySimilarity,
  roleSimilarity,
  cityMatch,
  score
}: {
  companySimilarity: number;
  roleSimilarity: number;
  cityMatch: boolean;
  score: number;
}): RecruitmentMatchConfidence {
  if (companySimilarity >= 0.9 && (roleSimilarity >= 0.5 || cityMatch) && score >= 80) {
    return "HIGH";
  }
  if (companySimilarity >= 0.72 && score >= 55) {
    return "MEDIUM";
  }
  return "LOW";
}

function matchingReasons({
  companySimilarity,
  roleSimilarity,
  cityMatch,
  candidate
}: {
  companySimilarity: number;
  roleSimilarity: number;
  cityMatch: boolean;
  candidate: RecruitmentApplicationCandidate;
}) {
  const reasons: string[] = [];

  if (companySimilarity === 1) {
    reasons.push("公司名称完全匹配");
  } else if (companySimilarity >= 0.88) {
    reasons.push("公司名称包含匹配");
  } else if (companySimilarity > 0) {
    reasons.push(`公司名称相似度 ${Math.round(companySimilarity * 100)}%`);
  }

  if (roleSimilarity > 0) {
    reasons.push(`岗位标题 token 重叠 ${Math.round(roleSimilarity * 100)}%`);
  }

  if (cityMatch && candidate.city) {
    reasons.push(`线下地址包含候选城市“${candidate.city}”`);
  }

  return reasons;
}

function normalizeCompanyName(value: string | null | undefined) {
  let normalized = normalizeComparableText(value);
  while (/(?:有限责任公司|股份有限公司|有限公司|集团|公司|incorporated|inc|ltd|llc)$/.test(normalized)) {
    normalized = normalized.replace(/(?:有限责任公司|股份有限公司|有限公司|集团|公司|incorporated|inc|ltd|llc)$/, "");
  }
  return normalized;
}

function normalizeComparableText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function normalizeCityText(value: string | null | undefined) {
  return normalizeComparableText(value).replace(/市$/, "");
}

function companyNameSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 3 && longer.includes(shorter)) return 0.9;

  return Math.max(tokenOverlap(companyTokens(left), companyTokens(right)), diceCoefficient(characterBigrams(left), characterBigrams(right)));
}

function companyTokens(value: string) {
  const tokens = new Set<string>();
  for (const part of value.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) || []) {
    tokens.add(part);
  }
  return tokens;
}

function roleTokens(value: string) {
  const tokens = new Set<string>();
  for (const part of value.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) || []) {
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      if (part.length === 1) {
        tokens.add(part);
      } else {
        for (let index = 0; index < part.length - 1; index += 1) {
          tokens.add(part.slice(index, index + 2));
        }
      }
    } else {
      tokens.add(part);
    }
  }
  return tokens;
}

function characterBigrams(value: string) {
  const tokens = new Set<string>();
  if (value.length < 2) {
    if (value) tokens.add(value);
    return tokens;
  }
  for (let index = 0; index < value.length - 1; index += 1) {
    tokens.add(value.slice(index, index + 2));
  }
  return tokens;
}

function tokenOverlap(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return (2 * shared) / (left.size + right.size);
}

function diceCoefficient(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return tokenOverlap(left, right);
}

function cityAppearsInAddress(city: string, address: string) {
  return city.length >= 2 && address.includes(city);
}
