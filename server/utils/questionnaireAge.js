/**
 * Age helpers for questionnaire eligibility.
 * Ages are stored and compared as total months.
 */

function calculateAgeInMonths(dob, asOf = new Date()) {
  if (!dob) return null;

  const birth = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;

  const asOfDate = asOf instanceof Date ? asOf : new Date(asOf);
  let months =
    (asOfDate.getFullYear() - birth.getFullYear()) * 12 +
    (asOfDate.getMonth() - birth.getMonth());

  if (asOfDate.getDate() < birth.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function monthsToYearsAndMonths(totalMonths) {
  if (totalMonths === null || totalMonths === undefined) {
    return { years: null, months: null };
  }
  const value = Number(totalMonths);
  if (Number.isNaN(value) || value < 0) {
    return { years: null, months: null };
  }
  return {
    years: Math.floor(value / 12),
    months: value % 12,
  };
}

function yearsAndMonthsToTotal(years, months) {
  const y = years === "" || years === null || years === undefined ? 0 : Number(years);
  const m =
    months === "" || months === null || months === undefined ? 0 : Number(months);

  if (Number.isNaN(y) || Number.isNaN(m) || y < 0 || m < 0) {
    return null;
  }

  if (y === 0 && m === 0 && (years === "" || years == null) && (months === "" || months == null)) {
    return null;
  }

  return y * 12 + m;
}

function formatAgeMonths(totalMonths) {
  if (totalMonths === null || totalMonths === undefined) return null;
  const { years, months } = monthsToYearsAndMonths(totalMonths);
  const parts = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0 || years === 0) {
    parts.push(`${months} month${months === 1 ? "" : "s"}`);
  }
  return parts.join(" ");
}

function formatAgeRange(minAgeMonths, maxAgeMonths) {
  const hasMin = minAgeMonths !== null && minAgeMonths !== undefined;
  const hasMax = maxAgeMonths !== null && maxAgeMonths !== undefined;

  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax) {
    return `${formatAgeMonths(minAgeMonths)} – ${formatAgeMonths(maxAgeMonths)}`;
  }
  if (hasMin) return `${formatAgeMonths(minAgeMonths)} and above`;
  return `up to ${formatAgeMonths(maxAgeMonths)}`;
}

/**
 * @returns {{ inRange: boolean|null, reason: string|null, ageMonths: number|null, ageLabel: string|null }}
 * inRange null means no age limit configured or age unknown (treat as no restriction for warnings;
 * for hard lock, caller decides).
 */
function evaluateAgeAgainstLimits(ageMonths, minAgeMonths, maxAgeMonths) {
  const hasMin = minAgeMonths !== null && minAgeMonths !== undefined;
  const hasMax = maxAgeMonths !== null && maxAgeMonths !== undefined;

  if (!hasMin && !hasMax) {
    return {
      inRange: null,
      reason: null,
      ageMonths,
      ageLabel: ageMonths !== null ? formatAgeMonths(ageMonths) : null,
    };
  }

  if (ageMonths === null || ageMonths === undefined) {
    return {
      inRange: null,
      reason: "Child date of birth is required to check age eligibility.",
      ageMonths: null,
      ageLabel: null,
    };
  }

  const rangeLabel = formatAgeRange(minAgeMonths, maxAgeMonths);
  const ageLabel = formatAgeMonths(ageMonths);

  if (hasMin && ageMonths < minAgeMonths) {
    return {
      inRange: false,
      reason: `This screening is intended for children aged ${rangeLabel}. This child is currently ${ageLabel} old.`,
      ageMonths,
      ageLabel,
    };
  }

  if (hasMax && ageMonths > maxAgeMonths) {
    return {
      inRange: false,
      reason: `This screening is intended for children aged ${rangeLabel}. This child is currently ${ageLabel} old.`,
      ageMonths,
      ageLabel,
    };
  }

  return {
    inRange: true,
    reason: null,
    ageMonths,
    ageLabel,
  };
}

function normalizeAgeMonthsInput(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.floor(n);
}

export {
  calculateAgeInMonths,
  monthsToYearsAndMonths,
  yearsAndMonthsToTotal,
  formatAgeMonths,
  formatAgeRange,
  evaluateAgeAgainstLimits,
  normalizeAgeMonthsInput,
};
