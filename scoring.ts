import type { ScoreMap, StandardsCheck } from "@/lib/types";

export const RATING_SCALE = [
  {
    score: 1,
    label: "Does not meet standard",
    desc: "One or more Performance Standards are not consistently met, or the majority of dimensions fall short of the Good descriptor. Triggers a documented support or improvement plan, not just a lower number.",
  },
  {
    score: 2,
    label: "Good",
    desc: "Performance Standards are consistently met; the majority of dimensions sit at the Good descriptor.",
  },
  {
    score: 3,
    label: "Better",
    desc: "Performance Standards are consistently met; the majority of dimensions sit at the Better descriptor or above.",
  },
  {
    score: 4,
    label: "Best",
    desc: "Performance Standards are consistently met; the majority of dimensions sit at the Best descriptor.",
  },
] as const;

export const TIER_LABEL: Record<number, string> = {
  1: "Does not meet standard",
  2: "Good",
  3: "Better",
  4: "Best",
};

export const TIER_CLASS: Record<number, string> = {
  1: "t1",
  2: "t2",
  3: "t3",
  4: "t4",
};

/**
 * Overall sign-off score for a review cycle.
 *
 * Rule (from the Skye review sign-off rating scale):
 *  - Overall is the majority tier across rated dimensions; ties resolve
 *    to the LOWER tier.
 *  - If any Performance Standard is marked "not met", the overall score
 *    is forced to 1 (Does not meet standard) regardless of how the
 *    dimensions scored. This cap is deliberate and must never be
 *    softened client-side — it is also re-applied server-side via the
 *    `compute_overall` SQL function so it can't be bypassed by calling
 *    the API directly.
 */
export function computeOverall(
  scores: ScoreMap | null | undefined,
  standardsCheck: StandardsCheck | null | undefined
): number | null {
  const vals = Object.values(scores || {}).filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 4
  );
  if (!vals.length) return null;

  const standardsAllMet = Object.values(standardsCheck || {}).every(
    (v) => v !== "notmet"
  );

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));

  let majority = 1;
  let best = -1;
  for (let t = 1; t <= 4; t++) {
    if (counts[t] > best) {
      best = counts[t];
      majority = t;
    }
  }

  if (!standardsAllMet) return 1;
  return majority;
}

export function tierDistribution(overalls: (number | null | undefined)[]) {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let total = 0;
  overalls.forEach((o) => {
    if (o && o >= 1 && o <= 4) {
      counts[o]++;
      total++;
    }
  });
  return { counts, total };
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isPast(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}
