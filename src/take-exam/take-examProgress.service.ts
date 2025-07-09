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
      console.log(`Calculating progress for examId: ${examId}, percentage: ${percentage}`);

      // Find or create progress document
      let progress = await this.examProgressModel.findOne({ examId }).exec();
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

        // Add to attempt_Log
        progress.attempt_Log.push({ percentage, timestamp: new Date() });

        // Increment attempts (optional, as attempt tracking is not used for round selection)
        progress.attempts = (progress.attempts || 0) + 1;
      }

      const savedProgress = await progress.save();
      console.log(`Saved progress: ${JSON.stringify(savedProgress)}`);
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
    examId: string,
    frontendQuestion: IFrontendQuestion,
    backendQuestions: IQuestion[],
  ): Promise<ExamProgressDocument> {
    try {
      // Log frontend question and answer
      console.log('Frontend question:', JSON.stringify(frontendQuestion, null, 2));
      // Log all backend questions
      console.log('Backend questions:', JSON.stringify(backendQuestions, null, 2));

      // Validate the answer
      const { isCorrect } = await validateAnswer(frontendQuestion, backendQuestions, 0);

      const backendQuestion = backendQuestions.find(
        (q) => q.question === frontendQuestion.question,
      );
      if (!backendQuestion) {
        throw new NotFoundException('No matching question found in backend data');
      }

      // Convert answers to strings for answerLog
      const selectedAnswer = Array.isArray(frontendQuestion.answer)
        ? frontendQuestion.answer.join(', ')
        : frontendQuestion.answer.toString();

      let correctAnswer: string;
      if (backendQuestion.question_type === 'true_false') {
        if (typeof backendQuestion.correct_options !== 'number' || !backendQuestion.exam_options) {
          throw new BadRequestException('Invalid correct_options or exam_options for true_false');
        }
        correctAnswer = backendQuestion.exam_options[backendQuestion.correct_options];
      } else if (backendQuestion.question_type === 'single_choice') {
        if (typeof backendQuestion.correct_options !== 'number' || !backendQuestion.exam_options) {
          throw new BadRequestException('Invalid correct_options or exam_options for single_choice');
        }
        correctAnswer = backendQuestion.exam_options[backendQuestion.correct_options];
      } else if (backendQuestion.question_type === 'multi_choice') {
        if (!Array.isArray(backendQuestion.correct_options) || !backendQuestion.exam_options) {
          throw new BadRequestException('Invalid correct_options or exam_options for multi_choice');
        }
        // Validate that all correct_options indices are valid
        if (
          backendQuestion.correct_options.some(
            (index) => !backendQuestion.exam_options || index < 0 || index >= backendQuestion.exam_options.length,
          )
        ) {
          throw new BadRequestException('Invalid correct_options indices for multi_choice');
        }
        correctAnswer = backendQuestion.correct_options
          .map((index) => backendQuestion.exam_options![index])
          .join(', ');
      } else {
        throw new BadRequestException(`Invalid question type: ${backendQuestion.question_type}`);
      }

      // Log selected and correct answers
      console.log('Selected answer:', selectedAnswer);
      console.log('Correct answer:', correctAnswer);
      console.log('Is correct:', isCorrect);

      // Initialize or update progress
      let progress = await this.examProgressModel.findOne({ examId }).exec();
      if (!progress) {
        progress = new this.examProgressModel({
          examId,
          total_questions: backendQuestions.length,
          correct_questions: isCorrect ? 1 : 0,
          has_started: true,
          attempts: 1,
          highest_percentage: 0,
          attempt_Log: [],
          lockUntil: null,
          answerLog: [],
        });
      } else {
        progress.correct_questions = progress.answerLog.filter((log) => log.isCorrect).length + (isCorrect ? 1 : 0);
        progress.total_questions = backendQuestions.length;
      }

      // Update answerLog
      progress.answerLog.push({
        questionId: new Types.ObjectId(), // Placeholder; replace with actual question ID if available
        selectedAnswer,
        correctAnswer,
        isCorrect,
        timeTaken: 0, // Update if time tracking is implemented
        timestamp: new Date(),
      });

      await progress.save();

      // Calculate progress based on answerLog
      const correctQuestions = progress.answerLog.filter((log) => log.isCorrect).length;
      return await this.calculateProgress(examId, backendQuestions.length, correctQuestions);
    } catch (error) {
      console.error('Error in submitAnswer:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process answer submission');
    }
  }
}