import { NotFoundException, BadRequestException } from '@nestjs/common';

// Define the Backend Question interface (authoritative, with correct answers)
export interface IQuestion {
  question: string;
  exam_options?: string[];
  question_type: 'single_choice' | 'multi_choice' | 'true_false';
  correct_options: string | string[] | boolean;
  points?: number; // Optional: for flexible scoring
}

// Define the Frontend Question interface (includes submitted answer)
export interface IFrontendQuestion {
  question: string;
  exam_options?: string[];
  question_type: 'single_choice' | 'multi_choice' | 'true_false';
  answer: string | string[] | boolean; // User's submitted answer
}

// Validation function
export function validateAnswer(
  frontendQuestion: IFrontendQuestion,
  backendQuestions: IQuestion[], // Array of backend questions to find the matching one
  currentScore: number = 0,
): { isCorrect: boolean; message?: string; updatedScore: number } {
  // Validate frontend input
  if (!frontendQuestion || !frontendQuestion.question || !frontendQuestion.question_type) {
    throw new BadRequestException('Invalid or missing question data from frontend');
  }
  if (frontendQuestion.answer === undefined || frontendQuestion.answer === null) {
    throw new BadRequestException('Invalid or missing answer data from frontend');
  }

  // Find matching backend question by question text
  const backendQuestion = backendQuestions.find(
    (q) => q.question === frontendQuestion.question,
  );
  if (!backendQuestion) {
    throw new NotFoundException('No matching question found in backend data');
  }

  // Validate question type consistency
  if (frontendQuestion.question_type !== backendQuestion.question_type) {
    throw new BadRequestException('Question type mismatch between frontend and backend');
  }

  // Validate exam_options consistency (if provided)
  if (frontendQuestion.exam_options && backendQuestion.exam_options) {
    if (
      frontendQuestion.exam_options.sort().join() !==
      backendQuestion.exam_options.sort().join()
    ) {
      throw new BadRequestException('Answer options mismatch between frontend and backend');
    }
  } else if (
    (frontendQuestion.exam_options && !backendQuestion.exam_options) ||
    (!frontendQuestion.exam_options && backendQuestion.exam_options)
  ) {
    throw new BadRequestException('Answer options presence mismatch between frontend and backend');
  }

  const submittedAnswer = frontendQuestion.answer;
  let isCorrect = false;
  let scoreIncrement = 0;

  switch (backendQuestion.question_type) {
    case 'single_choice':
      if (typeof submittedAnswer !== 'string') {
        throw new BadRequestException('Single choice answer must be a string');
      }
      if (typeof backendQuestion.correct_options !== 'string' && !Array.isArray(backendQuestion.correct_options)) {
        throw new BadRequestException('Invalid correct options for single choice');
      }
      isCorrect = typeof backendQuestion.correct_options === 'string'
        ? backendQuestion.correct_options === submittedAnswer
        : backendQuestion.correct_options[0] === submittedAnswer;
      scoreIncrement = isCorrect ? (backendQuestion.points || 1) : 0;
      break;

    case 'multi_choice':
      if (!Array.isArray(submittedAnswer) || submittedAnswer.length === 0) {
        throw new BadRequestException('Multi-choice answer must be a non-empty array');
      }
      if (!Array.isArray(backendQuestion.correct_options) || backendQuestion.correct_options.length === 0) {
        throw new BadRequestException('Invalid correct options for multi-choice');
      }
      isCorrect = submittedAnswer.sort().join() === backendQuestion.correct_options.sort().join();
      scoreIncrement = isCorrect ? (backendQuestion.points || 1) : 0;
      break;

    case 'true_false':
      if (typeof submittedAnswer !== 'boolean') {
        throw new BadRequestException('True/False answer must be a boolean');
      }
      if (typeof backendQuestion.correct_options !== 'boolean') {
        throw new BadRequestException('Invalid correct options for true/false');
      }
      isCorrect = submittedAnswer === backendQuestion.correct_options;
      scoreIncrement = isCorrect ? (backendQuestion.points || 1) : 0;
      break;

    default:
      throw new NotFoundException('Invalid question type');
  }

  return {
    isCorrect,
    message: isCorrect ? 'Correct answer!' : 'Incorrect answer.',
    updatedScore: currentScore + scoreIncrement,
  };
}