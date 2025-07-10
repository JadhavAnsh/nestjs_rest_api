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

  
  async  submitAnswer(
  this: any,
  examId: string,
  frontendPayload: { quiz_answers: { question: string; answer: string | string[] | boolean }[] },
  backendQuestions: IQuestion[],
): Promise<ExamProgressDocument> {
  try {
    // Validate payload structure
    if (!frontendPayload.quiz_answers || !Array.isArray(frontendPayload.quiz_answers)) {
      throw new BadRequestException('Invalid payload: quiz_answers must be an array');
    }

    // Log frontend payload and backend questions
    console.log('Frontend payload:', JSON.stringify(frontendPayload, null, 2));
    console.log('Backend questions:', JSON.stringify(backendQuestions, null, 2));

    // Validate backendQuestions length
    if (backendQuestions.length <= 0) {
      throw new BadRequestException('Invalid input: backendQuestions must contain at least one question');
    }

    // Initialize or fetch progress
    let progress = await this.examProgressModel.findOne({ examId }).exec();
    if (!progress) {
      progress = new this.examProgressModel({
        examId,
        total_questions: backendQuestions.length,
        correct_questions: 0,
        has_started: true,
        attempts: 1,
        highest_percentage: 0,
        attempt_Log: [],
        lockUntil: null,
        answerLog: [],
      });
    } else {
      progress.total_questions = backendQuestions.length;
      // Clear answerLog to ensure latest attempt answers only
      progress.answerLog = [];
    }

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

      currentScore = updatedScore  

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
      } else if (backendQuestion.question_type === 'multi_choice') {
        if (!backendQuestion.exam_options) {
          throw new BadRequestException('Invalid exam_options for multi_choice');
        }
        correctAnswer = (backendQuestion.correct_options as number[])
          .map((index) => backendQuestion.exam_options![index])
          .join(', ');
      } else {
        throw new BadRequestException(`Invalid question type: ${backendQuestion.question_type}`);
      }

      // Log answers
      console.log('Selected answer:', selectedAnswer);
      console.log('Correct answer:', correctAnswer);
      console.log('Is correct:', isCorrect);

      // Update answerLog
      progress.answerLog.push({
        questionId: new Types.ObjectId(),
        selectedAnswer,
        correctAnswer,
        isCorrect,
        timeTaken: 0,
        timestamp: new Date(),
      });
    }

    // Update correct_questions count
    progress.correct_questions = progress.answerLog.filter((log) => log.isCorrect).length;

    // Ensure correct_questions does not exceed total_questions
    if (progress.correct_questions > backendQuestions.length) {
      console.warn(`correct_questions (${progress.correct_questions}) exceeds total_questions (${backendQuestions.length}), adjusting correct_questions.`);
      progress.correct_questions = backendQuestions.length;
    }

    // Save progress
    await progress.save();

    // Calculate and return progress
    return await this.calculateProgress(
      examId,
      backendQuestions.length,
      progress.correct_questions,
    );
  } catch (error) {
    console.error('Error in submitAnswer:', error);
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException('Failed to process answer submission');
  }
}
}