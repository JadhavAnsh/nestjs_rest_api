import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Exam } from "./schema/exam.schema";
import { examProgress } from "./schema/exam-progress.schema";

@Injectable()
export class TakeExamProgressService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    @InjectModel(examProgress.name) private readonly examProgressModel: Model<examProgress>,
  ) {}

  async getProgressDetails(examId: string) {
    if (!examId) {
      throw new BadRequestException('Exam ID is required');
    }
    if (!Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid Exam ID format');
    }

    const exam = await this.examModel.findById(examId).exec();
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const totalQuestions = exam.Questions.length;
    const answered = exam.Questions.filter(
      (q) =>
        q.correct_options !== undefined ||
        (q.correct_multiple_options && q.correct_multiple_options.length > 0) ||
        typeof q.correct_boolean_option === 'boolean',
    ).length;

    return {
      exam_title: exam.title,
      exam_description: exam.description,
      exam_domain: exam.ExamDomain,
      level: exam.levels,
      duration: exam.time,
      qualification_tags: exam.QualificationTags,
      passing_score: exam.passingScore,
      total_questions: totalQuestions,
      questions_answered: answered,
      pending_questions: totalQuestions - answered,
      progress_percentage: Math.round((answered / totalQuestions) * 100),
    };
  }

  //todo for the saved the submit progress 
  async submitProgress(body: { examId: string; userID: string }) {
    const { examId, userID } = body;

    if (!examId || !userID) {
      throw new BadRequestException("Exam ID and User ID are required");
    }

    const exam = await this.examModel.findById(examId).exec();
    if (!exam) {
      throw new NotFoundException("Exam not found");
    }

    const totalQuestions = exam.Questions.length;
    const correctQuestions = exam.Questions.filter((q) =>
      q.correct_options !== undefined ||
      (q.correct_multiple_options && q.correct_multiple_options.length > 0) ||
      typeof q.correct_boolean_option === 'boolean'
    ).length;

    let progress = await this.examProgressModel.findOne({ userID, examId }).exec();

    if (!progress) {
      progress = new this.examProgressModel({
        userID: new Types.ObjectId(userID),
        examId: new Types.ObjectId(examId),
        totalQuestions,
        correctQuestions,
        completed: correctQuestions === totalQuestions,
        score: Math.round((correctQuestions / totalQuestions) * 100),
      });
      await progress.save();
    }

    return {
      message: "Progress saved successfully",
      progress,
    };
  }
}
