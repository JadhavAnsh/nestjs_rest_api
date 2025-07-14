import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ExamProgressDocument } from '../schema/exam-progress.schema';

export interface IQuestion {
  question: string;
  exam_options?: string[];
  question_type: 'single_choice' | 'multiple_choice' | 'true_false';
  correct_options: number | number[] | boolean;
  points?: number;
}

// Frontend Question interface (includes submitted answer)
export interface IFrontendQuestion {
  question: string;
  exam_options?: string[];
  question_type: 'single_choice' | 'multiple_choice' | 'true_false';
  answer: string | string[] | boolean;
}

// Validation function
export async function validateAnswer(
  frontendQuestion: IFrontendQuestion,
  backendQuestions: IQuestion[],
  currentScore: number = 0,
): Promise<{ isCorrect: boolean; message?: string; updatedScore: number }> {
  // Validate frontend input
  if (!frontendQuestion?.question || !frontendQuestion?.question_type) {
    throw new BadRequestException('Invalid or missing question data from frontend');
  }
  if (frontendQuestion.answer === undefined || frontendQuestion.answer === null) {
    throw new BadRequestException('Invalid or missing answer data from frontend');
  }

  // Normalize text to handle whitespace, multiple spaces, and special characters
  const normalizeText = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width spaces and other invisible characters

  // Find matching backend question by normalized question text
  const backendQuestion = backendQuestions.find(
    (q) => normalizeText(q.question) === normalizeText(frontendQuestion.question),
  );

  // If no match is found, log detailed mismatch info
  if (!backendQuestion) {
    throw new NotFoundException('No matching question found in backend data');
  }

  // Validate question type consistency
  if (frontendQuestion.question_type !== backendQuestion.question_type) {
    throw new BadRequestException('Question type mismatch between frontend and backend');
  }

  // Validate exam_options consistency
  if (frontendQuestion.exam_options && backendQuestion.exam_options) {
    if (frontendQuestion.exam_options.sort().join() !== backendQuestion.exam_options.sort().join()) {
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
      if (typeof backendQuestion.correct_options !== 'number') {
        throw new BadRequestException('Invalid correct options for single choice');
      }
      // Ensure exam_options exists and the correct_options index is valid
      if (
        !backendQuestion.exam_options ||
        backendQuestion.correct_options >= backendQuestion.exam_options.length
      ) {
        throw new BadRequestException('Invalid exam options or correct options index for single choice');
      }
      isCorrect = normalizeText(submittedAnswer) === normalizeText(backendQuestion.exam_options[backendQuestion.correct_options]);
      scoreIncrement = isCorrect ? (backendQuestion.points || 1) : 0;
      break;

    case 'multiple_choice':
      if (!Array.isArray(submittedAnswer) || submittedAnswer.length === 0) {
        throw new BadRequestException('Multiple choice answer must be a non-empty array');
      }
      if (!Array.isArray(backendQuestion.correct_options) || backendQuestion.correct_options.length === 0) {
        throw new BadRequestException('Invalid correct options for multiple choice');
      }
      // Ensure exam_options exists and all correct_options indices are valid
      if (
        !backendQuestion.exam_options ||
        backendQuestion.correct_options.some(
          (index) => index >= backendQuestion.exam_options!.length,
        )
      ) {
        throw new BadRequestException('Invalid exam options or correct options indices for multiple choice');
      }
      isCorrect =
        submittedAnswer.map(normalizeText).sort().join() ===
        backendQuestion.correct_options
          .map((index) => normalizeText(backendQuestion.exam_options![index]))
          .sort()
          .join();
      scoreIncrement = isCorrect ? (backendQuestion.points || 1) : 0;
      break;

    case 'true_false':
      if (typeof submittedAnswer !== 'boolean') {
        throw new BadRequestException('True/False answer must be a boolean');
      }
      if (typeof backendQuestion.correct_options !== 'number') {
        throw new BadRequestException('Invalid correct options for true/false');
      }
      // Map numeric correct_options (0 for true, 1 for false) to boolean
      const correctBoolean = backendQuestion.correct_options === 0 ? true : false;
      isCorrect = submittedAnswer === correctBoolean;
      scoreIncrement = isCorrect ? (backendQuestion.points || 1) : 0;
      break;

    default:
      throw new BadRequestException('Invalid question type');
  }

  return {
    isCorrect,
    message: isCorrect ? 'Correct answer!' : 'Incorrect answer.',
    updatedScore: currentScore + scoreIncrement,
  };
}