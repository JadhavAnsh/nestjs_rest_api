import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExamProgress, ExamProgressDocument } from './schema/exam-progress.schema';
import { IFrontendAnswer, IQuestion, validateAnswer } from './utils/question-validator.util';

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
  if (totalQuestions <= 0 || correctQuestions < 0 || correctQuestions > totalQuestions) {
    throw new Error('Invalid input: totalQuestions must be positive and correctQuestions must be valid');
  }

  const percentage = (correctQuestions / totalQuestions) * 100;
  console.log(`Calculating progress for examId: ${examId}, percentage: ${percentage}`);

  // Find existing progress or create new
  let progress = await this.examProgressModel.findOne({ examId });
  console.log(`Existing progress: ${JSON.stringify(progress)}`);

  if (!progress) {
    console.log('Creating new progress document');
    progress = new this.examProgressModel({
      examId,
      total_questions: totalQuestions,
      correct_questions: correctQuestions,
      has_started: true,
      attempts: 1,
      highest_percentage: percentage,
      attempt_Log: [{ percentage, timestamp: new Date() }],
      lockUntil: null,
    });
  } else {
    // // Check if progress is locked
    // if (progress.lockUntil && progress.lockUntil > new Date()) {
    //   console.log(`Progress is locked until: ${progress.lockUntil}`);
    //   throw new Error(`Progress is locked until ${progress.lockUntil.toISOString()}`);
    // }

    // // If lock has expired, clear it and reset attempts
    // if (progress.lockUntil && progress.lockUntil <= new Date()) {
    //   console.log('Lock has expired, clearing lock and resetting attempts');
    //   progress.lockUntil = null;
    //   progress.attempts = 0; // Reset attempts when lock expires
    // }

    // Update existing progress
    progress.correct_questions = correctQuestions;
    progress.total_questions = totalQuestions;
    progress.attempts += 1;
    progress.has_started = true;
    progress.is_completed = correctQuestions === totalQuestions;

    // Update highest percentage if current is higher
    if (percentage > progress.highest_percentage) {
      progress.highest_percentage = percentage;
    }

    // Add to attempt log
    progress.attempt_Log.push({ percentage, timestamp: new Date() });

    // // Apply lock after 3 attempts
    // if (progress.attempts >= 3) {
    //   progress.lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // Lock for 24 hours
    //   console.log(`Lock applied: attempts=${progress.attempts}, lockUntil=${progress.lockUntil}`);
    // } else {
    //   progress.lockUntil = null; // Ensure lock is cleared if attempts < 3
    //   console.log(`No lock applied: attempts=${progress.attempts}`);
    // }
  }

  const savedProgress = await progress.save();
  console.log(`Saved progress: ${JSON.stringify(savedProgress)}`);
  return savedProgress;
}

  async getProgress(examId: string): Promise<ExamProgressDocument | null> {
    const progress = await this.examProgressModel.findOne({ examId });

    if (!progress) {
      return null;
    }

    // Check if progress is locked
    // if (progress.lockUntil && progress.lockUntil > new Date()) {
    //   throw new Error('Progress is locked until ' + progress.lockUntil.toISOString());
    // }

    return progress;
  }

  // New method to handle answer submission
  async submitAnswer(
    examId: string,
    frontendAnswer: IFrontendAnswer,
    question: IQuestion, // Assume question is provided (e.g., fetched from Exam model)
  ): Promise<ExamProgressDocument> {
    try {
      // Fetch existing progress
      const progress = await this.examProgressModel.findOne({ examId });
      if (!progress) {
        throw new NotFoundException(`Progress for exam ID ${examId} not found`);
      }

      // // Check if progress is locked
      // if (progress.lockUntil && progress.lockUntil > new Date()) {
      //   throw new BadRequestException(
      //     `Progress is locked until ${progress.lockUntil.toISOString()}`,
      //   );
      // }

      // Validate the answer
      const { isCorrect } = validateAnswer(question, frontendAnswer, progress.correct_questions);

      // Update correct_questions if the answer is correct
      const newCorrectQuestions = isCorrect
        ? progress.correct_questions + 1
        : progress.correct_questions;

      // Call calculateProgress to update progress
      return await this.calculateProgress(
        examId,
        progress.total_questions,
        newCorrectQuestions,
      );
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Failed to process answer submission');
    }
  }
}