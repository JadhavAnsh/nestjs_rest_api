// src/take-exam/utils/question-validator.util.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Define the Question interface based on your exam.schema.ts
export interface IQuestion {
  _id?: string;
  question: string;
  exam_options?: string[];
  question_type: 'single_choice' | 'multi_choice' | 'true_false';
  correct_options: string | string[] | boolean;
}

// Define interface for frontend answer submission
export interface IFrontendAnswer {
  questionId: string;
  answer: string | string[] | boolean;
}

// Validation function
export function validateAnswer(
  question: IQuestion,
  frontendAnswer: IFrontendAnswer,
  currentScore: number = 0,
): { isCorrect: boolean; message?: string; updatedScore: number } {
  if (!question) {
    throw new NotFoundException('Question data is required');
  }

  if (!frontendAnswer || !frontendAnswer.questionId || frontendAnswer.answer === undefined) {
    throw new BadRequestException('Invalid or missing answer data from frontend');
  }

  if (frontendAnswer.questionId !== question._id?.toString()) {
    throw new BadRequestException('Question ID mismatch');
  }

  const submittedAnswer = frontendAnswer.answer;
  let isCorrect = false;
  let scoreIncrement = 0;

  switch (question.question_type) {
    case 'single_choice'://for single choice 
      if (typeof submittedAnswer !== 'string') {
        throw new BadRequestException('Single choice answer must be a string');
      }
      isCorrect = Array.isArray(question.correct_options)
        ? question.correct_options[0] === submittedAnswer
        : false;
      scoreIncrement = isCorrect ? 1 : 0; // Example: 1 points for correct single choice
      break;
    case 'multi_choice'://for multiple choice 
      if (!Array.isArray(submittedAnswer)) {
        throw new BadRequestException('Multi-choice answer must be an array');
      }
      isCorrect = Array.isArray(submittedAnswer) && Array.isArray(question.correct_options)
        ? submittedAnswer.sort().join() === question.correct_options.sort().join()
        : false;
      scoreIncrement = isCorrect ? 1 : 0; // Example: 1 points for correct multi-choice
      break;
    case 'true_false'://for the boolen
      if (typeof submittedAnswer !== 'boolean') {
        throw new BadRequestException('True/False answer must be a boolean');
      }
      isCorrect = typeof submittedAnswer === 'boolean'
        ? submittedAnswer === question.correct_options
        : false;
      scoreIncrement = isCorrect ? 1 : 0; // Example: 1 points for correct true/false
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