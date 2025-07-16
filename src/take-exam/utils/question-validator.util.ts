import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ExamProgressDocument } from '../schema/exam-progress.schema';

// Backend Question
export interface IQuestion {
  _id: Types.ObjectId;
  question: string;
  exam_options?: string[];
  question_type: 'single_choice' | 'multiple_choice' | 'true_false';
  correct_options: number | number[] | boolean;
  points?: number;
}

// Frontend Question interface (includes submitted answer)
export interface IFrontendQuestion {
  _id: string;
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
  if (!frontendQuestion?._id || !frontendQuestion?.question_type) {
    throw new BadRequestException('Invalid or missing question data from frontend');
  }
  if (frontendQuestion.answer === undefined || frontendQuestion.answer === null) {
    throw new BadRequestException('Invalid or missing answer data from frontend');
  }

  // Find matching backend question by _id
  const backendQuestion = backendQuestions.find(
    (q) => q._id.toString() === frontendQuestion._id,
  );

  // If no match is found
  if (!backendQuestion) {
    throw new NotFoundException(`No matching question found for ID: ${frontendQuestion._id}`);
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

  // Normalize text to handle whitespace, multiple spaces, and special characters
  const normalizeText = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');

  switch (backendQuestion.question_type) {
    case 'single_choice':
      if (typeof submittedAnswer !== 'string') {
        throw new BadRequestException('Single choice answer must be a string');
      }
      if (typeof backendQuestion.correct_options !== 'number') {
        throw new BadRequestException('Invalid correct options for single choice');
      }
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