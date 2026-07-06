export const questionOrderBy = [
  { order: "asc" },
  { question_id: "asc" },
];

export const optionOrderBy = [
  { order_number: "asc" },
  { option_id: "asc" },
];

export function getQuestionSortKey(question) {
  const order =
    question?.order ??
    question?.questionnaires_questions?.order ??
    Number.MAX_SAFE_INTEGER;
  const questionId = question?.question_id ?? 0;
  return { order, questionId };
}

export function compareQuestions(a, b) {
  const keyA = getQuestionSortKey(a);
  const keyB = getQuestionSortKey(b);

  if (keyA.order !== keyB.order) {
    return keyA.order - keyB.order;
  }

  return keyA.questionId - keyB.questionId;
}

export function sortQuestions(questions) {
  return [...questions].sort((a, b) => {
    const parentA = a?.parentID ?? null;
    const parentB = b?.parentID ?? null;

    if (parentA === null && parentB !== null) return -1;
    if (parentA !== null && parentB === null) return 1;

    if (parentA !== null && parentB !== null && parentA !== parentB) {
      return parentA - parentB;
    }

    return compareQuestions(a, b);
  });
}

export function sortQuestionAnswers(answers) {
  return [...answers].sort((a, b) => {
    const parentA = a?.parentID ?? a?.questionnaires_questions?.parentID ?? null;
    const parentB = b?.parentID ?? b?.questionnaires_questions?.parentID ?? null;

    if (parentA === null && parentB !== null) return -1;
    if (parentA !== null && parentB === null) return 1;

    if (parentA !== null && parentB !== null && parentA !== parentB) {
      return parentA - parentB;
    }

    return compareQuestions(
      {
        order: a?.question_order ?? a?.questionnaires_questions?.order,
        question_id: a?.question_id,
      },
      {
        order: b?.question_order ?? b?.questionnaires_questions?.order,
        question_id: b?.question_id,
      },
    );
  });
}

export function mapSortedAnswers(answers, mapper) {
  return sortQuestionAnswers(answers).map(mapper);
}
