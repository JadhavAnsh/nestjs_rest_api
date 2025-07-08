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
} from '@nestjs/common';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamProgressDocument } from './schema/exam-progress.schema';
import { Exam } from './schema/exam.schema';
import { TakeExamService } from './take-exam.service';
import { ExamProgressService } from './take-examProgress.service';

// Define interfaces for type safety
interface RoadmapData {
  roadmap_title: string;
  modules: {
    module_title: string;
    units: {
      unit_type: string;
      subunit: {
        read?: { title: string };
      }[];
    }[];
  }[];
}

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
  async createExam(@Body() createExamDto: CreateExamDto): Promise<Exam> {
    return this.takeExamService.createExam(createExamDto);
  }

  @Post('generate')
  async generateExamByRoadmapTitle(
    @Body() body: { roadmapData: RoadmapData; roadmapId: string; examId: string },
  ): Promise<Exam> {
    const { roadmapData, roadmapId, examId } = body;

    // Validate input
    if (!roadmapData || !roadmapId || !examId) {
      this.logger.error(
        `Missing required fields: ${!roadmapData ? 'roadmapData' : ''} ${
          !roadmapId ? 'roadmapId' : ''
        } ${!examId ? 'examId' : ''}`.trim(),
      );
      throw new HttpException(
        'Missing required fields: roadmapData, roadmapId, or examId',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate roadmapData structure
    if (!roadmapData.roadmap_title || typeof roadmapData.roadmap_title !== 'string') {
      this.logger.error(`Invalid roadmapData: roadmap_title is missing or not a string`);
      throw new HttpException(
        'Invalid roadmapData: roadmap_title must be a non-empty string',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!Array.isArray(roadmapData.modules) || roadmapData.modules.length === 0) {
      this.logger.error(`Invalid roadmapData: modules is missing or empty`);
      throw new HttpException(
        'Invalid roadmapData: modules must be a non-empty array',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(roadmapId) || !uuidRegex.test(examId)) {
      this.logger.error('Invalid UUID format for roadmapId or examId');
      throw new HttpException('Invalid roadmapId or examId format', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`Generating exam for roadmapId: ${roadmapId}, examId: ${examId}`);
      this.logger.debug(`Request body: ${JSON.stringify(body, null, 2)}`);
      const exam = await this.takeExamService.generateExamByRoadmapTitle(roadmapData, roadmapId, examId);
      this.logger.log(`Exam generated successfully: ${examId}`);
      return exam;
    } catch (error) {
      this.logger.error(`Failed to generate exam: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to process exam generation request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
