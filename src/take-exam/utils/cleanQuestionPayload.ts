import { QuestionType } from 'src/common/enum/question-type.enum';

function cleanQuestionPayload(question: any) {
  const q = { ...question }; // Shallow clone

  // Validate and clean correct_option_indexes based on question type
  if (q.question_type === QuestionType.SINGLE_CHOICE) {
    if (
      !Array.isArray(q.correct_options) ||
      q.correct_options.length !== 1 ||
      !q.correct_options.every((v: any) => Number.isInteger(Number(v)) && Number(v) >= 0)
    ) {
      delete q.correct_options; // Remove invalid array
    }
  } else if (q.question_type === QuestionType.MULTIPLE_CHOICE) {
    if (
      !Array.isArray(q.correct_options) ||
      q.correct_options.length < 2 ||
      !q.correct_options.every((v: any) => Number.isInteger(Number(v)) && Number(v) >= 0)
    ) {
      delete q.correct_options; // Remove invalid array
    }
  } else if (q.question_type === QuestionType.TRUE_FALSE) {
    if (
      !Array.isArray(q.correct_options) ||
      q.correct_options.length !== 1 ||
      !q.correct_options.every((v: any) => Number.isInteger(Number(v)) && v >= 0 && v < 2)
    ) {
      delete q.correct_options; // Remove invalid array
    }
  } else {
    delete q.correct_options; // Remove if question_type is invalid
  }

  // Remove any undefined, null, or empty array fields
  Object.keys(q).forEach((key) => {
    const val = q[key];
    if (
      val === undefined ||
      val === null ||
      (Array.isArray(val) && val.length === 0)
    ) {
      delete q[key];
    }
  });

  return q;
}

function cleanQuestionResponse(question: any) {
  const cleaned = { ...question };
  // Ensure correct_option_indexes is only included if valid for the question type
  if (
    !cleaned.question_type ||
    !Array.isArray(cleaned.correct_options) ||
    (cleaned.question_type === QuestionType.SINGLE_CHOICE && cleaned.correct_options.length !== 1) ||
    (cleaned.question_type === QuestionType.MULTIPLE_CHOICE && cleaned.correct_options.length < 2) ||
    (cleaned.question_type === QuestionType.TRUE_FALSE && (cleaned.correct_options.length !== 1 || !cleaned.correct_options.every((v: number) => v >= 0 && v < 2)))
  ) {
    delete cleaned.correct_options;
  }
  return cleaned;
}

export { cleanQuestionPayload, cleanQuestionResponse };
