import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';
import { TakeExamService } from './take-exam.service';
import { ExamProgressService } from './take-examProgress.service';
import { ExamProgressDocument } from './schema/exam-progress.schema';
import { IFrontendQuestion, IQuestion } from './utils/question-validator.util';

@Controller('take-exam')
export class TakeExamController {
  constructor(
    private readonly takeExamService: TakeExamService,
    private readonly takeExamProgressService: ExamProgressService,
  ) {}

  @Post()
  async createExam(@Body() createExamDto: CreateExamDto): Promise<Exam> {
    return this.takeExamService.createExam(createExamDto);
  }

  @Post('calculate/:examId')
  async calculateProgress(
    @Param('examId') examId: string,
    @Body() body: { totalQuestions: number; correctQuestions: number },
  ): Promise<ExamProgressDocument> {
    try {
      const { totalQuestions, correctQuestions } = body;
      if (!totalQuestions || !correctQuestions || totalQuestions < correctQuestions) {
        throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
      }
      return await this.takeExamProgressService.calculateProgress(examId, totalQuestions, correctQuestions);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to calculate progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('get/:examId')
  async getProgress(@Param('examId') examId: string): Promise<ExamProgressDocument | null> {
    try {
      const progress = await this.takeExamProgressService.getProgress(examId);
      if (!progress) {
        throw new HttpException('Progress not found', HttpStatus.NOT_FOUND);
      }
      return progress;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve progress',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

 @Post('submit/:examId')
async submitAnswer(
  @Param('examId') examId: string,
  @Body() body: { frontendAnswer: any; question: any },
): Promise<ExamProgressDocument> {
  try {
    const { frontendAnswer, question } = body;
    if (!frontendAnswer || !question || !question.question || !question.question_type) {
      throw new HttpException('Missing or invalid answer/question data', HttpStatus.BAD_REQUEST);
    }

    const frontendQuestion: IFrontendQuestion = {
      ...question,
      answer: frontendAnswer,
    };

    const exam = await this.takeExamService.findExamById(examId);
    if (!exam) {
      console.error(`Exam not found for examId: ${examId}`);
      throw new HttpException('Exam not found', HttpStatus.NOT_FOUND);
    }
    if (!exam.exam_questions) {
      console.error(`Exam questions not defined for examId: ${examId}`);
      throw new HttpException('Exam questions not found', HttpStatus.NOT_FOUND);
    }
    if (!Array.isArray(exam.exam_questions)) {
      console.error(`Exam questions is not an array for examId: ${examId}`);
      throw new HttpException('Invalid exam questions format', HttpStatus.NOT_FOUND);
    }
    if (!exam.exam_questions.length) {
      console.error(`No questions available for examId: ${examId}`);
      throw new HttpException('No questions available for this exam', HttpStatus.NOT_FOUND);
    }

    const backendQuestions: IQuestion[] = exam.exam_questions.map((q: any) => ({
      question: q.question,
      exam_options: q.exam_options,
      question_type: q.question_type,
      correct_options: q.correct_options,
      points: 1,
    }));

    return await this.takeExamProgressService.submitAnswer(examId, frontendQuestion, backendQuestions);
  } catch (error) {
    console.error('Error in submitAnswer:', error);
    throw new HttpException(
      error.message || 'Failed to submit answer',
      HttpStatus.BAD_REQUEST,
    );
  }
}

}