import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    const newExam = new this.examModel(createExamDto);
    return await newExam.save();
  }
}
