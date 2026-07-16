export const DIARY_CATEGORIES = [
  { key: 'category_1', label: 'Category 1' },
  { key: 'category_2', label: 'Category 2' },
  { key: 'category_3', label: 'Category 3' },
  { key: 'category_4', label: 'Category 4' },
  { key: 'category_5', label: 'Category 5' },
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
