import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateExamDto, GenerateExamDto } from './dto/create-exam.dto';
import { ExamProgressDocument } from './schema/exam-progress.schema';
import { Exam } from './schema/exam.schema';
import { TakeExamService } from './take-exam.service';
import { ExamProgressService } from './take-examProgress.service';

@Controller('take-exam')
export class TakeExamController {
  private readonly logger = new Logger(TakeExamController.name);
  
  constructor(
    private readonly takeExamService: TakeExamService,
    private readonly takeExamProgressService: ExamProgressService,
  ) {}

  @Get()
  async getExamByRoadmapId(
    @Query('roadmap_ID') roadmapId: string,
  ): Promise<Exam> {
    const exam = await this.takeExamService.getExamByRoadmapId(roadmapId);
    if (!exam) {
      throw new NotFoundException(
        `Exam with roadmap_ID ${roadmapId} not found`,
      );
    }
    return exam;
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createExam(@Body() createExamDto: CreateExamDto): Promise<Exam> {
    return this.takeExamService.createExam(createExamDto);
  }

  @Post('generate')
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateExam(@Body() generateExamDto: GenerateExamDto): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    try {
      this.logger.log(
        `Received exam generation request for roadmap: ${generateExamDto.roadmapId}`,
      );

      // Generate exam with AI enhancement
      const generatedExam = await this.takeExamService.generateExamWithAI(
        generateExamDto.roadmapId,
        generateExamDto.examId,
        generateExamDto.roadmapData,
      );

      return {
        success: true,
        message: 'Exam generated successfully',
        data: {
          examId: generatedExam.exam_ID,
          roadmapId: generatedExam.roadmap_ID,
          title: generatedExam.exam_title,
          description: generatedExam.exam_description,
          totalQuestions: 90,
          rounds: 3,
          examLevel: generatedExam.exam_levels,
          passingScore: generatedExam.passing_score,
          timeLimit: generatedExam.exam_time,
          tags: generatedExam.tags,
        },
      };
    } catch (error) {
      this.logger.error(`Error generating exam: ${error.message}`, error.stack);

      return {
        success: false,
        message: 'Failed to generate exam',
        error: error.message,
      };
    }
  }

  @Post(':examId/calculate')
  async calculateProgress(
    @Param('examId') examId: string,
    @Body() body: { totalQuestions: number; correctQuestions: number },
  ): Promise<ExamProgressDocument> {
    try {
      const { totalQuestions, correctQuestions } = body;
      if (
        !totalQuestions ||
        !correctQuestions ||
        totalQuestions < correctQuestions
      ) {
        throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
      }
      return await this.takeExamProgressService.calculateProgress(
        examId,
        totalQuestions,
        correctQuestions,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to calculate progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':examId')
  async getProgress(
    @Query('examId') examId: string,
  ): Promise<ExamProgressDocument | null> {
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
}