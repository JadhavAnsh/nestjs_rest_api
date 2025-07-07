import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';
import { TakeExamService } from './take-exam.service';
import { ExamProgressService } from './take-examProgress.service';
import { ExamProgressDocument } from './schema/exam-progress.schema';

@Controller('take-exam')
export class TakeExamController {
  constructor(
    private readonly takeExamService: TakeExamService,
    private readonly takeExamProgressService: ExamProgressService,
  ) {}

  // @Get()
  // async getAllExams(): Promise<Exam[]> {
  //   return this.takeExamService.getAllExams();
  // }

  // @Get(':id')
  // async getExamById(@Param('id') id: string): Promise<Exam> {
  //   return this.takeExamService.getExamById(id);
  // }

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
      if (!frontendAnswer || !question) {
        throw new HttpException('Missing answer or question data', HttpStatus.BAD_REQUEST);
      }
      return await this.takeExamProgressService.submitAnswer(examId, frontendAnswer, question);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to submit answer',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
