// Configurable "composite" scoring for questionnaires.
//
// A questionnaire may define one or more scoring groups in
// `questionnaires.composite_scoring_config` (JSON). Each group takes a set of
// questions, applies a weight to each answer value, sums them, divides by a
// divisor to get an average, then maps that average to a discrete score via
// ordered bands. The resulting group score feeds the questionnaire total_score.
//
// When the config is absent/invalid, callers fall back to the normal flat-sum
// scoring, so existing questionnaires are completely unaffected.
//
// Config shape (all numbers are admin-configurable, nothing is hardcoded):
// {
//   "composite_groups": [
//     {
//       "label": "Screen Time (SEQ)",
//       "members": [
//         { "question_id": 101, "weight": 5 },
//         { "question_id": 102, "weight": 5 },
//         { "question_id": 103, "weight": 2 },
//         { "question_id": 104, "weight": 2 }
//       ],
//       "divisor": 7,
//       "bands": [
//         { "upTo": 2, "score": 0 },   // average < 2         -> 0
//         { "upTo": 4, "score": 1 },   // 2 <= average < 4    -> 1
//         { "score": 2 }               // average >= 4        -> 2 (catch-all)
//       ],
//       "exclude_members_from_raw_sum": true
//     }
//   ]
// }

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeMember(rawMember) {
  if (!rawMember || typeof rawMember !== "object") return null;

  const questionId = toFiniteNumber(rawMember.question_id);
  if (questionId === null) return null;

  const weight = toFiniteNumber(rawMember.weight);

  return {
    question_id: parseInt(questionId, 10),
    // Default weight of 1 keeps the group usable even if a weight is missing.
    weight: weight === null ? 1 : weight,
  };
}

function normalizeBand(rawBand) {
  if (!rawBand || typeof rawBand !== "object") return null;

  const score = toFiniteNumber(rawBand.score);
  if (score === null) return null;

  const hasUpTo =
    rawBand.upTo !== undefined && rawBand.upTo !== null && rawBand.upTo !== "";
  const upTo = hasUpTo ? toFiniteNumber(rawBand.upTo) : null;

  return {
    // A null upTo means "no upper bound" (catch-all band).
    upTo,
    score,
  };
}

function normalizeGroup(rawGroup) {
  if (!rawGroup || typeof rawGroup !== "object") return null;

  const members = Array.isArray(rawGroup.members)
    ? rawGroup.members.map(normalizeMember).filter(Boolean)
    : [];

  const bands = Array.isArray(rawGroup.bands)
    ? rawGroup.bands.map(normalizeBand).filter(Boolean)
    : [];

  if (members.length === 0 || bands.length === 0) return null;

  const divisorRaw = toFiniteNumber(rawGroup.divisor);
  const divisor = divisorRaw !== null && divisorRaw > 0 ? divisorRaw : null;
  if (divisor === null) return null;

  return {
    label:
      typeof rawGroup.label === "string" && rawGroup.label.trim() !== ""
        ? rawGroup.label.trim()
        : "Composite score",
    members,
    divisor,
    bands,
    // Defaults to true so member raw values are not double-counted in the total.
    exclude_members_from_raw_sum:
      rawGroup.exclude_members_from_raw_sum === false ? false : true,
  };
}

// Parses and validates the raw config. Returns a normalized config object with a
// non-empty `composite_groups` array, or null when there is nothing usable.
export function parseCompositeScoringConfig(raw) {
  if (!raw) return null;

  let parsed = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  const rawGroups = Array.isArray(parsed.composite_groups)
    ? parsed.composite_groups
    : [];

  const composite_groups = rawGroups.map(normalizeGroup).filter(Boolean);

  if (composite_groups.length === 0) return null;

  return { composite_groups };
}

// Maps an average to a band score. Bands are matched by ascending `upTo`
// (null/no upper bound is treated as the highest catch-all band), and the first
// band whose upper bound the average falls under wins (average < upTo).
function mapAverageToBandScore(average, bands) {
  const sorted = [...bands].sort((a, b) => {
    const aUp = a.upTo === null ? Infinity : a.upTo;
    const bUp = b.upTo === null ? Infinity : b.upTo;
    return aUp - bUp;
  });

  for (const band of sorted) {
    const upperBound = band.upTo === null ? Infinity : band.upTo;
    if (average < upperBound) {
      return band.score;
    }
  }

  // Fallback: highest band's score (covers averages equal to the last bound).
  return sorted[sorted.length - 1].score;
}

// Computes composite group scores from a map of { question_id: numericValue }.
// Returns the total score contributed by all groups, the set of member question
// ids (so callers can avoid double-counting), and a per-group breakdown.
export function computeCompositeScores(config, answersByQuestionId) {
  const result = {
    groupScoresTotal: 0,
    memberQuestionIds: new Set(),
    groups: [],
  };

  if (!config || !Array.isArray(config.composite_groups)) {
    return result;
  }

  const answers = answersByQuestionId || {};

  for (const group of config.composite_groups) {
    let weightedSum = 0;

    for (const member of group.members) {
      const rawValue = toFiniteNumber(answers[member.question_id]);
      const value = rawValue === null ? 0 : rawValue;
      weightedSum += value * member.weight;

      if (group.exclude_members_from_raw_sum) {
        result.memberQuestionIds.add(member.question_id);
      }
    }

    const average = weightedSum / group.divisor;
    const score = mapAverageToBandScore(average, group.bands);

    result.groupScoresTotal += score;
    result.groups.push({
      label: group.label,
      weighted_sum: weightedSum,
      average,
      score,
    });
  }

  return result;
}

// Validates a config coming from the admin UI before persisting it.
// Returns { ok, message, config } where config is the normalized object.
export function validateCompositeScoringConfig(rawConfig) {
  // Allow clearing the config (null / empty removes composite scoring).
  if (
    rawConfig === null ||
    rawConfig === undefined ||
    rawConfig === "" ||
    (typeof rawConfig === "object" &&
      Array.isArray(rawConfig.composite_groups) &&
      rawConfig.composite_groups.length === 0)
  ) {
    return { ok: true, config: null };
  }

  let parsed = rawConfig;
  if (typeof rawConfig === "string") {
    try {
      parsed = JSON.parse(rawConfig);
    } catch (error) {
      return { ok: false, message: "Scoring config is not valid JSON" };
    }
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.composite_groups)) {
    return { ok: false, message: "Scoring config must contain a composite_groups array" };
  }

  for (let i = 0; i < parsed.composite_groups.length; i++) {
    const group = parsed.composite_groups[i];
    const label = `Group ${i + 1}`;

    if (!group || typeof group !== "object") {
      return { ok: false, message: `${label}: invalid group` };
    }

    if (!Array.isArray(group.members) || group.members.length === 0) {
      return { ok: false, message: `${label}: at least one question is required` };
    }

    for (const member of group.members) {
      if (toFiniteNumber(member?.question_id) === null) {
        return { ok: false, message: `${label}: each member needs a valid question` };
      }
      if (toFiniteNumber(member?.weight) === null) {
        return { ok: false, message: `${label}: each question needs a numeric weight` };
      }
    }

    const divisor = toFiniteNumber(group.divisor);
    if (divisor === null || divisor <= 0) {
      return { ok: false, message: `${label}: divisor must be a number greater than 0` };
    }

    if (!Array.isArray(group.bands) || group.bands.length === 0) {
      return { ok: false, message: `${label}: at least one score band is required` };
    }

    for (const band of group.bands) {
      if (toFiniteNumber(band?.score) === null) {
        return { ok: false, message: `${label}: each band needs a numeric score` };
      }
      const hasUpTo =
        band?.upTo !== undefined && band?.upTo !== null && band?.upTo !== "";
      if (hasUpTo && toFiniteNumber(band.upTo) === null) {
        return { ok: false, message: `${label}: band upper bound must be a number` };
      }
    }
  }

  const normalized = parseCompositeScoringConfig(parsed);
  if (!normalized) {
    return { ok: false, message: "Scoring config is incomplete or invalid" };
  }

  return { ok: true, config: normalized };
}
