import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ExamProgress,
  ExamProgressDocument,
} from './schema/exam-progress.schema';
import {
  IFrontendQuestion,
  IQuestion,
  validateAnswer,
} from './utils/question-validator.util';

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

      let progress = await this.examProgressModel.findOne({ examId }).exec();

      if (!progress) {
        progress = new this.examProgressModel({
          examId,
          total_questions: totalQuestions,
          correct_questions: correctQuestions,
          attempts: 0,
          highest_percentage: percentage,
          attempt_Log: [],
          lockUntil: null,
          answerLog: [],
        });
      } else {
        progress.total_questions = totalQuestions;
        progress.correct_questions = correctQuestions;

        if (percentage > progress.highest_percentage) {
          progress.highest_percentage = percentage;
        }
      }

      return progress;
    } catch (error) {
      console.error('Error in calculateProgress:', error);
      throw new BadRequestException('Failed to calculate progress');
    }
  }

  async submitAnswer(
    this: any,
    examId: string,
    frontendPayload: {
      quiz_answers: { question: string; answer: string | string[] | boolean }[];
    },
    backendQuestions: IQuestion[],
  ): Promise<any> {
    try {
      // Validate payload
      if (
        !frontendPayload.quiz_answers ||
        !Array.isArray(frontendPayload.quiz_answers)
      ) {
        throw new BadRequestException(
          'Invalid payload: quiz_answers must be an array',
        );
      }

      if (backendQuestions.length <= 0) {
        throw new BadRequestException(
          'Invalid input: backendQuestions must contain at least one question',
        );
      }

      // Fetch or create progress
      let progress = await this.examProgressModel.findOne({ examId }).exec();
      const attemptTimestamp = new Date();

      if (!progress) {
        progress = new this.examProgressModel({
          examId,
          total_questions: backendQuestions.length,
          correct_questions: 0,
          //has_started: true,
          attempts: 0,
          highest_percentage: 0,
          attempt_Log: [],
          lockUntil: null,
          lockCount: 0,
          answerLog: [],
          lastSubmittedAt: null,
        });
        console.log(`[${attemptTimestamp.toISOString()}] Created new progress`);
      } else {
        //  Lock check
        if (progress.lockUntil && progress.lockUntil > new Date()) {
          const remainingSec = Math.ceil(
            (progress.lockUntil.getTime() - new Date().getTime()) / 1000,
          );
          throw new BadRequestException(
            `Exam is locked. Try again in ${remainingSec} seconds.`,
          );
        }

        //  If lock expired and 3 locks reached → reset everything
        if (
          progress.lockUntil &&
          progress.lockUntil <= new Date() &&
          progress.attempts >= 3
        ) {
          progress.attempts = 0;
          progress.lockUntil = null;
          progress.lockCount = 0;
          console.log(
            `[${attemptTimestamp.toISOString()}] Lock expired after 3 attempts → attempts reset`,
          );
        } else if (progress.lockUntil && progress.lockUntil <= new Date()) {
          //  Lock expired but not after 3rd attempt
          progress.lockUntil = null;
          console.log(`[${attemptTimestamp.toISOString()}] Lock expired`);
        }
      }

      // Always update total questions and clear answer log
      progress.total_questions = backendQuestions.length;
      progress.answerLog = [];

      //  Increment attempts
      progress.attempts = (progress.attempts || 0) + 1;
      console.log(
        `[${attemptTimestamp.toISOString()}] Attempt #${progress.attempts}`,
      );

      //  Reset correct question count
      progress.correct_questions = 0;

      let currentScore = 0;

      // Evaluate answers
      for (const frontendAnswer of frontendPayload.quiz_answers) {
        const backendQuestion = backendQuestions.find(
          (q) => q.question === frontendAnswer.question,
        );
        if (!backendQuestion) {
          throw new NotFoundException(
            `No matching question found for "${frontendAnswer.question}"`,
          );
        }

        // For accepting the boolean as string or boolean both okays
        let answer = frontendAnswer.answer;
        if (backendQuestion.question_type === 'true_false') {
          if (typeof answer === 'string') {
            if (answer.toLowerCase() === 'true') {
              answer = true;
            } else if (answer.toLowerCase() === 'false') {
              answer = false;
            } else {
              throw new BadRequestException('True/False answer must be a boolean or "true"/"false" string');
            }
          } else if (typeof answer !== 'boolean') {
            throw new BadRequestException('True/False answer must be a boolean');
          }
        }

        const frontendQuestion: IFrontendQuestion = {
          question: frontendAnswer.question,
          question_type: backendQuestion.question_type,
          answer: answer,
          exam_options: backendQuestion.exam_options,
        };

        const { isCorrect, updatedScore } = await validateAnswer(
          frontendQuestion,
          backendQuestions,
          currentScore,
        );
        currentScore = updatedScore;

        const selectedAnswer = Array.isArray(frontendAnswer.answer)
          ? frontendAnswer.answer.join(', ')
          : frontendAnswer.answer.toString();

        let correctAnswer: string;
        if (backendQuestion.question_type === 'true_false') {
          correctAnswer = (
            backendQuestion.correct_options === 0 ? true : false
          ).toString();
        } else if (backendQuestion.question_type === 'single_choice') {
          if (!backendQuestion.exam_options)
            throw new BadRequestException('Missing options');
          correctAnswer =
            backendQuestion.exam_options[
              backendQuestion.correct_options as number
            ];
        } else if (backendQuestion.question_type === 'multiple_choice') {
          if (!backendQuestion.exam_options)
            throw new BadRequestException('Missing options');
          correctAnswer = (backendQuestion.correct_options as number[])
            .map((index) => backendQuestion.exam_options![index])
            .join(', ');
        } else {
          throw new BadRequestException(
            `Unknown type: ${backendQuestion.question_type}`,
          );
        }

        progress.answerLog.push({
          selectedAnswer,
          correctAnswer,
          isCorrect,
          timeTaken: 0,
          timestamp: attemptTimestamp,
        });
      }

      //  Count correct answers
      const correctCount = progress.answerLog.reduce(
        (sum, log) => sum + (log.isCorrect ? 1 : 0),
        0,
      );
      progress.correct_questions = Math.min(
        correctCount,
        backendQuestions.length,
      );

      //  Calculate percentage
      const percentage =
        (progress.correct_questions / backendQuestions.length) * 100;
      progress.lastSubmittedAt = attemptTimestamp;

      //  Log attempt
      progress.attempt_Log.push({ percentage, timestamp: attemptTimestamp });
      console.log(
        `[${attemptTimestamp.toISOString()}] Attempt logged: ${percentage}%`,
      );

      //  Update highest if needed
      if (percentage > progress.highest_percentage) {
        progress.highest_percentage = percentage;
      }

      //  Lock after 3 attempts
      if (progress.attempts >= 3) {
        progress.lockUntil = new Date(Date.now() + 1 * 60 * 1000); // 1 minute
        progress.lockCount = (progress.lockCount || 0) + 1;
        console.log(
          `[${attemptTimestamp.toISOString()}] Lock applied (1 minute), lockCount=${progress.lockCount}`,
        );
      }

      //  Mark as completed if all correct
      progress.is_completed = true;

      //  Save all changes
      await progress.save();
      console.log(`[${attemptTimestamp.toISOString()}] Progress saved`);

      const examProgress = await this.calculateProgress(
        examId,
        backendQuestions.length,
        progress.correct_questions,
      );

      return {
        ...examProgress.toObject(),
        lastSubmittedAt: progress.lastSubmittedAt,
      };
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error in submitAnswer:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to process answer submission');
    }
  }
}
