import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';

@Injectable()
export class TakeExamService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
  ) {}

  async getExamByRoadmapId(roadmapId: string): Promise<Exam> {
    try {
      const exams = await this.examModel.aggregate([
        { $match: { roadmap_ID: roadmapId } },
        { $unwind: '$exam_questions' },
        { $sample: { size: 25 } },
        {
          $group: {
            _id: '$_id',
            roadmap_ID: { $first: '$roadmap_ID' },
            exam_ID: { $first: '$exam_ID' },
            exam_title: { $first: '$exam_title' },
            exam_description: { $first: '$exam_description' },
            passing_score: { $first: '$passing_score' },
            exam_time: { $first: '$exam_time' },
            exam_levels: { $first: '$exam_levels' },
            tags: { $first: '$tags' },
            exam_questions: { $push: '$exam_questions' },
          },
        },
      ]);

      if (!exams || exams.length === 0) {
        throw new NotFoundException(
          `Exam with roadmap_ID ${roadmapId} not found`,
        );
      }

      return exams[0];
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve exam');
    }
  }

  async createExam(createExamDto: CreateExamDto): Promise<Exam> {
    try {
      // Check if exam_ID already exists
      const existingExam = await this.examModel
        .findOne({ exam_ID: createExamDto.exam_ID })
        .exec();
      if (existingExam) {
        throw new ConflictException(
          `Exam with ID ${createExamDto.exam_ID} already exists`,
        );
      }

      // Create new exam instance
      const exam = new this.examModel({
        ...createExamDto,
        exam_questions: createExamDto.exam_questions.map((question) => ({
          question: question.question,
          exam_options: question.exam_options,
          question_type: question.question_type,
          correct_options: question.correct_options,
        })),
      });

      // Save to database
      const savedExam = await exam.save();
      return savedExam;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create exam');
    }
  }
}
