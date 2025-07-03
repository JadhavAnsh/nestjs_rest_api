import { QuestionType } from 'src/common/enum/question-type.enum';

function cleanQuestionPayload(question: any) {
  const q = { ...question }; // Shallow clone

  // Ensure correct_multiple_options is only included for MCQ and has exactly 2 valid numbers
  if (q.question_type === QuestionType.MULTIPLE_CHOICE) {
    if (
      !Array.isArray(q.correct_multiple_options) ||
      q.correct_multiple_options.length !== 2 ||
      !q.correct_multiple_options.every((v: any) => typeof v === 'number')
    ) {
      delete q.correct_multiple_options; // Remove invalid or empty array
    }
    delete q.correct_options;
    delete q.correct_boolean_option;
  } else if (q.question_type === QuestionType.SINGLE_CHOICE) {
    delete q.correct_multiple_options;
    delete q.correct_boolean_option;
    if (typeof q.correct_options !== 'number') {
      delete q.correct_options; // Ensure valid number
    }
  } else if (q.question_type === QuestionType.TRUE_FALSE) {
    delete q.correct_options;
    delete q.correct_multiple_options;
    if (typeof q.correct_boolean_option !== 'boolean') {
      delete q.correct_boolean_option; // Ensure valid boolean
    }
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
  if (cleaned.question_type !== QuestionType.SINGLE_CHOICE) {
    delete cleaned.correct_options;
  }
  if (cleaned.question_type !== QuestionType.MULTIPLE_CHOICE) {
    delete cleaned.correct_multiple_options;
  }
  if (cleaned.question_type !== QuestionType.TRUE_FALSE) {
    delete cleaned.correct_boolean_option;
  }
  return cleaned;
}

export { cleanQuestionPayload, cleanQuestionResponse };
