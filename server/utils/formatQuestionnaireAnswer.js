export function cleanOptionTitle(optionTitle) {
  if (!optionTitle) return "";
  return optionTitle.replace(/^\[(radio|checkbox|scale|text|textarea)\]/, "").trim();
}

export function mapQuestionnaireAnswer(answer) {
  const question = answer.questionnaires_questions;
  const rawScore = answer.score;

  return {
    answer_id: answer.answer_id,
    question_id: answer.question_id,
    question_order: question?.order ?? null,
    question_text: question?.question_text_bi || "Unknown",
    question_text_bm: question?.question_text_bm || "",
    answer_type: question?.answer_type ?? null,
    option_id: answer.option_id,
    option_title: answer.questionnaires_questions_action
      ? cleanOptionTitle(answer.questionnaires_questions_action.option_title) || ""
      : "",
    option_title_bm: answer.questionnaires_questions_action?.option_title_bm || "",
    option_value: answer.questionnaires_questions_action?.option_value || 0,
    text_answer: answer.text_answer || "",
    numeric_answer: answer.numeric_answer ?? null,
    score: rawScore ?? 0,
    parent_question_id: question?.parentID || null,
    parentID: question?.parentID || null,
  };
}
