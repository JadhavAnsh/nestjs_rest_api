import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';
import {
  cleanQuestionPayload,
  cleanQuestionResponse,
} from './utils/cleanQuestionPayload';

@Injectable()
export class TakeExamService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
  ) {}

  async getAllExams(): Promise<any[]> {
    const exams = await this.examModel.find().lean();
    return exams.map((exam) => ({
      ...exam,
      Questions: exam.Questions.map((q) => cleanQuestionResponse(q)),
    }));
  }

  async getExamById(id: string): Promise<any> {
    const exam = await this.examModel.findById(id).lean(); // lean is important
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    exam.Questions = exam.Questions.map((q) => cleanQuestionResponse(q));
    return exam;
  }

  async createExam(createExamDto: CreateExamDto): Promise<Exam> {
    const cleanedQuestions = createExamDto.Questions.map(
      (q) => cleanQuestionPayload({ ...q }), // clone first!
    );

    const cleanExamPayload = {
      examId: createExamDto.examId, // generate a unique ID if not provided
      title: createExamDto.title,
      ExamDomain: createExamDto.ExamDomain,
      description: createExamDto.description,
      passingScore: createExamDto.passingScore,
      examAttempts: createExamDto.examAttempts,
      time: createExamDto.time,
      levels: createExamDto.levels,
      QualificationTags: createExamDto.QualificationTags,
      Questions: cleanedQuestions,
    };

    const exam = new this.examModel(cleanExamPayload);
    await exam.save();
    return exam;
  }
}
