import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExamProgress, ExamProgressDocument } from './schema/exam-progress.schema';
import { IFrontendQuestion, IQuestion, validateAnswer } from './utils/question-validator.util';

@Injectable()
export class ExamProgressService {
  constructor(
    @InjectModel(ExamProgress.name)
    private examProgressModel: Model<ExamProgressDocument>,
  ) {}

  async calculateProgress(
    examId: string,
    totalQuestions: number,
    correctQuestions: number,
  ): Promise<ExamProgressDocument> {
    try {
      // Validate inputs
      if (
        !Number.isInteger(totalQuestions) ||
        !Number.isInteger(correctQuestions) ||
        totalQuestions <= 0 ||
        correctQuestions < 0 ||
        correctQuestions > totalQuestions
      ) {
        throw new BadRequestException(
          'Invalid input: totalQuestions and correctQuestions must be non-negative integers, and correctQuestions must not exceed totalQuestions',
        );
      }

      const percentage = (correctQuestions / totalQuestions) * 100;

      // Find progress document
      let progress = await this.examProgressModel.findOne({ examId }).exec();

      if (!progress) {
        // If no progress found, create new with initial values but do not increment attempts or add to attempt_Log here
        progress = new this.examProgressModel({
          examId,
          total_questions: totalQuestions,
          correct_questions: correctQuestions,
          has_started: true,
          attempts: 0,
          highest_percentage: percentage,
          attempt_Log: [],
          lockUntil: null,
          answerLog: [], // Initialize empty answerLog
        });
      } else {
        // Update progress with new values
        progress.total_questions = totalQuestions;
        progress.correct_questions = correctQuestions;
        progress.has_started = true;
        progress.is_completed = correctQuestions === totalQuestions;

        // Update highest_percentage if the new percentage is higher
        if (percentage > progress.highest_percentage) {
          progress.highest_percentage = percentage;
        }

        // Do NOT update attempts or attempt_Log here to avoid duplication
      }

      const savedProgress = await progress.save();
      return savedProgress;
    } catch (error) {
      console.error('Error in calculateProgress:', error);
      throw new BadRequestException('Failed to calculate progress');
    }
  }

  async getProgress(examId: string): Promise<ExamProgressDocument | null> {
    return await this.examProgressModel.findOne({ examId }).exec();
  }

  
 async submitAnswer(
  this: any,
  examId: string,
  frontendPayload: { quiz_answers: { question: string; answer: string | string[] | boolean }[] },
  backendQuestions: IQuestion[],
): Promise<any> {
  try {
    // Validate payload structure
    if (!frontendPayload.quiz_answers || !Array.isArray(frontendPayload.quiz_answers)) {
      throw new BadRequestException('Invalid payload: quiz_answers must be an array');
    }

    // Validate backendQuestions length
    if (backendQuestions.length <= 0) {
      throw new BadRequestException('Invalid input: backendQuestions must contain at least one question');
    }

    // Initialize or fetch progress
    let progress = await this.examProgressModel.findOne({ examId }).exec();
    const attemptTimestamp = new Date(); // Capture current timestamp for the attempt
    console.log(`[${attemptTimestamp.toISOString()}] Starting attempt for examId: ${examId}, current attempts: ${progress?.attempts || 0}`);

    if (!progress) {
      progress = new this.examProgressModel({
        examId,
        total_questions: backendQuestions.length,
        correct_questions: 0,
        has_started: true,
        attempts: 0,
        highest_percentage: 0,
        attempt_Log: [],
        lockUntil: null,
        answerLog: [],
        lastSubmittedAt: null,
      });
      console.log(`[${attemptTimestamp.toISOString()}] Created new progress document for examId: ${examId}`);
    } else {
      // Check if exam is locked
      if (progress.lockUntil && progress.lockUntil > new Date()) {
        const remainingTime = Math.ceil((progress.lockUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60));
        throw new BadRequestException(`Exam is locked. Please try again in ${remainingTime} hours.`);
      }

      progress.total_questions = backendQuestions.length;
      // Clear answerLog to ensure latest attempt answers only
      progress.answerLog = [];
      console.log(`[${attemptTimestamp.toISOString()}] Cleared answerLog for examId: ${examId}`);
    }

    // Increment attempt count
    progress.attempts = (progress.attempts || 0) + 1;
    console.log(`[${attemptTimestamp.toISOString()}] Incremented attempts to: ${progress.attempts}`);

    let currentScore = 0; // Reset currentScore for latest attempt

    // Process each answer in the payload
    for (const frontendAnswer of frontendPayload.quiz_answers) {
      const backendQuestion = backendQuestions.find((q) => q.question === frontendAnswer.question);
      if (!backendQuestion) {
        throw new NotFoundException(`No matching question found for "${frontendAnswer.question}"`);
      }

      // Prepare frontend question for validation
      const frontendQuestion: IFrontendQuestion = {
        question: frontendAnswer.question,
        question_type: backendQuestion.question_type,
        answer: frontendAnswer.answer,
        exam_options: backendQuestion.exam_options,
      };

      // Validate answer
      const { isCorrect, updatedScore } = await validateAnswer(
        frontendQuestion,
        backendQuestions,
        currentScore,
      );

      currentScore = updatedScore;

      // Convert answers to strings for answerLog
      const selectedAnswer = Array.isArray(frontendAnswer.answer)
        ? frontendAnswer.answer.join(', ')
        : frontendAnswer.answer.toString();

      let correctAnswer: string;
      if (backendQuestion.question_type === 'true_false') {
        correctAnswer = (backendQuestion.correct_options === 0 ? true : false).toString();
      } else if (backendQuestion.question_type === 'single_choice') {
        if (!backendQuestion.exam_options) {
          throw new BadRequestException('Invalid exam_options for single_choice');
        }
        correctAnswer = backendQuestion.exam_options[backendQuestion.correct_options as number];
      } else if (backendQuestion.question_type === 'multiple_choice') {
        if (!backendQuestion.exam_options) {
          throw new BadRequestException('Invalid exam_options for multi_choice');
        }
        correctAnswer = (backendQuestion.correct_options as number[])
          .map((index) => backendQuestion.exam_options![index])
          .join(', ');
      } else {
        throw new BadRequestException(`Invalid question type: ${backendQuestion.question_type}`);
      }

      // Update answerLog
      progress.answerLog.push({
        selectedAnswer,
        correctAnswer,
        isCorrect,
        timeTaken: 0,
        timestamp: attemptTimestamp,
      });
    }

    // Calculate correct_questions count based on isCorrect property in answerLog
    const correctCount = progress.answerLog.reduce((count, log) => count + (log.isCorrect ? 1 : 0), 0);
    progress.correct_questions = correctCount;

    // Ensure correct_questions does not exceed total_questions
    if (progress.correct_questions > backendQuestions.length) {
      progress.correct_questions = backendQuestions.length;
    }

    // Calculate percentage for the attempt
    const percentage = (progress.correct_questions / backendQuestions.length) * 100;

    // Update lastSubmittedAt with the latest attempt timestamp
    progress.lastSubmittedAt = attemptTimestamp;

    // Update attempt log with percentage and timestamp only to match schema
    progress.attempt_Log.push({
      percentage: percentage,
      timestamp: attemptTimestamp,
    });
    console.log(`[${attemptTimestamp.toISOString()}] Pushed to attempt_Log: percentage=${percentage}`);

    // Update highest_percentage if current percentage is higher
    if (percentage > progress.highest_percentage) {
      progress.highest_percentage = percentage;
    }

    // Apply lock only after 3rd attempt
    if (progress.attempts >= 3) {
      progress.lockUntil = new Date(Date.now() + 8 * 60 * 60 * 1000); // Set 8-hour lock
      console.log(`[${attemptTimestamp.toISOString()}] Lock applied for 8 hours, lockUntil: ${progress.lockUntil}`);
    }

    // Save progress (only once)
    await progress.save();
    console.log(`[${attemptTimestamp.toISOString()}] Progress saved for examId: ${examId}`);

    // Calculate progress summary without modifying attempts or attempt_Log
    const examProgress = await this.calculateProgress(
      examId,
      backendQuestions.length,
      progress.correct_questions,
    );

    // Convert Mongoose document to plain object and return response with lastSubmittedAt
    return {
      ...examProgress.toObject(),
      lastSubmittedAt: progress.lastSubmittedAt,
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in submitAnswer:`, error);
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException('Failed to process answer submission');
  }
}
}