import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuestionType } from 'src/common/enum/question-type.enum';
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';

@Injectable()
export class TakeExamService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
  ) {}

  async getAllExams(): Promise<Exam[]> {
    return this.examModel.find().exec();
  }

  async getExamById(id: string): Promise<Exam> {
    const exam = await this.examModel.findById(id).exec();
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  async createExam(createExamDto: CreateExamDto): Promise<Exam> {
    // Strip irrelevant keys and empty arrays
    createExamDto.Questions = createExamDto.Questions.map((q) => {
      const cleaned: any = {
        question: q.question,
        exam_options: q.exam_options,
        question_type: q.question_type,
      };

      if (
        q.question_type === QuestionType.SINGLE_CHOICE &&
        q.correct_options !== undefined
      ) {
        cleaned.correct_options = q.correct_options;
      }

      if (
        q.question_type === QuestionType.MULTIPLE_CHOICE &&
        Array.isArray(q.correct_multiple_options) &&
        q.correct_multiple_options.length === 2
      ) {
        cleaned.correct_multiple_options = q.correct_multiple_options;
      }

      if (
        q.question_type === QuestionType.TRUE_FALSE &&
        typeof q.correct_boolean_option === 'boolean'
      ) {
        cleaned.correct_boolean_option = q.correct_boolean_option;
      }

      return cleaned;
    });

    const newExam = new this.examModel(createExamDto);
    return await newExam.save();
  }
}
