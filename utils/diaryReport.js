export const DIARY_CATEGORIES = [
  {
    key: 'two_way_communication',
    label: 'Two-way communication (Komunikasi dua hala)',
  },
  {
    key: 'emotional_regulation',
    label: 'Emotional regulation (Kawalan emosi)',
  },
  {
    key: 'focus_and_comprehension',
    label: 'Focus and comprehension (Fokus dan kefahaman)',
  },
  {
    key: 'feeding_and_sensory',
    label: 'Feeding and sensory needs (Pemakanan dan sensori)',
  },
  {
    key: 'sleep_and_daily_routines',
    label: 'Sleep and daily routines (Tidur dan rutin harian)',
  },
  {
    key: 'socialisation_self_confidence',
    label: 'Socialisation and self-confidence (Sosialisasi dan keyakinan diri)',
  },
];

export const OPTIONAL_NOTES_LABEL = 'Additional Notes (Optional)';

export function hasAnyCategoryInEntry(entry) {
  return DIARY_CATEGORIES.some(({ key }) => entry?.[key]?.trim?.());
}

export function isLegacyDiaryEntry(entry) {
  return !hasAnyCategoryInEntry(entry) && !!entry?.description?.trim?.();
}

export function getDiaryEntryLines(entry) {
  if (isLegacyDiaryEntry(entry)) {
    return [{ label: null, value: entry.description.trim() }];
  }

  const lines = [];

  DIARY_CATEGORIES.forEach(({ key, label }) => {
    const value = entry?.[key]?.trim?.();
    if (value) {
      lines.push({ label, value });
    }
  });

  if (entry?.description?.trim?.()) {
    lines.push({
      label: OPTIONAL_NOTES_LABEL,
      value: entry.description.trim(),
    });
  }

  return lines;
}

export function formatDiaryEntryText(entry) {
  return getDiaryEntryLines(entry)
    .map(({ label, value }) => (label ? `${label}: ${value}` : value))
    .join('\n');
}
