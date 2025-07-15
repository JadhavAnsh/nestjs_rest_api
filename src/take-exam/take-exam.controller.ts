import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
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
import { IQuestion } from './utils/question-validator.util';

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
  ): Promise<any> {
    const response = await this.takeExamService.getExamByRoadmapId(roadmapId);
    if (!response) {
      throw new NotFoundException(
        `Exam with roadmap_ID ${roadmapId} not found`,
      );
    }
    return response;
  }

  @Get(':examId')
  async findExamById(@Param('examId') examId: string): Promise<Exam> {
    const exam = await this.takeExamService.findExamById(examId);
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
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
  async generateExam(@Body() generateExamDto: GenerateExamDto): Promise<any> {
    try {
      this.logger.log(
        `Received exam generation request for roadmap: ${generateExamDto.roadmapId}`,
      );

      // Generate exam with AI enhancement and store in database
      const generatedExam = await this.takeExamService.generateExamWithAI(
        generateExamDto.roadmapId,
        generateExamDto.examId,
        generateExamDto.roadmapData,
      );

      this.logger.log(
        `Successfully generated and stored exam with ID: ${generateExamDto.examId}`,
      );

      return {
        message: 'Exam generated and stored successfully',
        exam: generatedExam,
      };
    } catch (error) {
      this.logger.error(`Error generating exam: ${error.message}`, error.stack);

      throw new InternalServerErrorException({
        message: 'Failed to generate exam',
        error: error.message,
      });
    }
  }

  @Post('calculate/:examId')
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

  @Post('submit/:examId')
  async submitAnswer(
    @Param('examId') examId: string,
    @Body()
    body: {
      quiz_answers: { question: string; answer: string | string[] | boolean }[];
    },
  ): Promise<ExamProgressDocument> {
    try {
      const { quiz_answers } = body;

      // Validate quiz_answers
      if (
        !quiz_answers ||
        !Array.isArray(quiz_answers) ||
        quiz_answers.length === 0
      ) {
        throw new HttpException(
          'Invalid or missing quiz_answers data',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate each answer entry
      for (const answer of quiz_answers) {
        if (
          !answer.question ||
          answer.answer === undefined ||
          answer.answer === null
        ) {
          throw new HttpException(
            'Missing or invalid question/answer data in quiz_answers',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Fetch exam data
      const exam = await this.takeExamService.findExamById(examId);
      if (!exam) {
        console.error(`Exam not found for examId: ${examId}`);
        throw new HttpException('Exam not found', HttpStatus.NOT_FOUND);
      }

      // Prepare rounds questions map
      const roundsMap: { [key: string]: IQuestion[] } = {
        round_1: (exam.round_1 || []).map((q: any) => ({
          question: q.question,
          exam_options: q.exam_options,
          question_type: q.question_type,
          correct_options: q.correct_options,
          points: 1,
        })),
        round_2: (exam.round_2 || []).map((q: any) => ({
          question: q.question,
          exam_options: q.exam_options,
          question_type: q.question_type,
          correct_options: q.correct_options,
          points: 1,
        })),
        round_3: (exam.round_3 || []).map((q: any) => ({
          question: q.question,
          exam_options: q.exam_options,
          question_type: q.question_type,
          correct_options: q.correct_options,
          points: 1,
        })),
      };

      // Find which round the frontend answers belong to
      let matchedRound = '';
      let matchedBackendQuestions: IQuestion[] = [];
      let maxMatchCount = 0;
      for (const [round, questions] of Object.entries(roundsMap)) {
        const questionSet = new Set(questions.map((q) => q.question));
        const matchCount = quiz_answers.filter((answer) =>
          questionSet.has(answer.question),
        ).length;
        if (matchCount > maxMatchCount) {
          maxMatchCount = matchCount;
          matchedRound = round;
          matchedBackendQuestions = questions;
        }
      }

      if (!matchedRound || maxMatchCount === 0) {
        throw new HttpException(
          'No matching round found for the provided answers',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Prepare frontend payload for the matched round
      const frontendPayload = { quiz_answers };

      // Call submitAnswer for the matched round
      return await this.takeExamProgressService.submitAnswer(
        examId,
        frontendPayload,
        matchedBackendQuestions,
      );
    } catch (error) {
      console.error('Error in submitAnswer:', error);
      throw new HttpException(
        error.message || 'Failed to submit answer',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
