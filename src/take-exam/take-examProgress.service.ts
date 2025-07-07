import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExamProgress, ExamProgressDocument } from './schema/exam-progress.schema';
import { IFrontendQuestion, IQuestion, validateAnswer } from './utils/question-validator.util';

// Placeholder: Assume an Exam model for fetching questions
interface IExam {
  _id: string;
  questions: IQuestion[];
}

// TODO : want the Question & answer form the take exam 

@Injectable()
export class ExamProgressService {
  constructor(
    @InjectModel(ExamProgress.name)
    private examProgressModel: Model<ExamProgressDocument>,
    // Placeholder: Inject Exam model (uncomment and adjust if you have an Exam model)
    // @InjectModel(Exam.name)
    // private examModel: Model<IExam>,
  ) {}

  async calculateProgress(
    examId: string,
    totalQuestions: number,
    correctQuestions: number,
  ): Promise<ExamProgressDocument> {
    if (totalQuestions <= 0 || correctQuestions < 0 || correctQuestions > totalQuestions) {
      throw new BadRequestException(
        'Invalid input: totalQuestions must be positive and correctQuestions must be valid',
      );
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
    }

    const savedProgress = await progress.save();
    console.log(`Saved progress: ${JSON.stringify(savedProgress)}`);
    return savedProgress;
  }

  async getProgress(examId: string): Promise<ExamProgressDocument | null> {
    const progress = await this.examProgressModel.findOne({ examId });
    return progress;
  }

  async submitAnswer(
    examId: string,
    frontendQuestion: IFrontendQuestion,
    backendQuestions: IQuestion[], // Array of questions from Exam model
  ): Promise<ExamProgressDocument> {
    try {
      // Fetch existing progress
      const progress = await this.examProgressModel.findOne({ examId });
      if (!progress) {
        throw new NotFoundException(`Progress for exam ID ${examId} not found`);
      }

      // Validate the answer using the updated validator
      const { isCorrect } = validateAnswer(frontendQuestion, backendQuestions, progress.correct_questions);

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
      throw new BadRequestException('Failed to process answer submission');
    }
  }

  // Example method to fetch backend questions (uncomment and adjust if you have an Exam model)
  /*
  async fetchBackendQuestions(examId: string): Promise<IQuestion[]> {
    const exam = await this.examModel.findById(examId);
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }
    return exam.questions;
  }
  */
}