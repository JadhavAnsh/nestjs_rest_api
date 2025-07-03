import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Exam } from "./schema/exam.schema";
import { ExamProgress } from "./schema/exam-progress.schema";

@Injectable()
export class TakeExamProgressService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    @InjectModel(ExamProgress.name) private readonly examProgressModel: Model<ExamProgress>,
  ) {}


  //todo for the saved the submit progress 
 
}
