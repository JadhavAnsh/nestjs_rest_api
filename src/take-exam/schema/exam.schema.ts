import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ExamLevel } from 'src/common/enum/exam-level.enum';
import { Question, QuestionSchema } from './question.schema';

@Schema({ timestamps: true })
export class Exam extends Document {
  @Prop({ required: true, unique: true })
  roadmap_ID: string; // "Take reference from roadmap schema"

  @Prop({ required: true, unique: true })
  exam_ID: string; // "Auto generated ID by function"

  @Prop({ required: true, unique: true })
  exam_title: string; // "Title of the Exam as per the roadmap"

  @Prop()
  exam_description: string; // "Exam description not the roadmap"

  @Prop({ required: true, min: 0, max: 100 })
  passing_score: number; // "Passing score needed to pass the exam eg: 80%"

  @Prop({ required: true, min: 1 })
  exam_time: number; // "Time in minutes to complete the exam"

  @Prop({ required: true, enum: ExamLevel })
  exam_levels: ExamLevel; // "easy", "medium", "hard" Its an Enum

  @Prop({ type: [String], index: true })
  tags: string[]; // "Technologies used in the exam"

  @Prop({ type: [QuestionSchema], required: true })
  round_1: Question[]; // "Questions of the Exam" Its an Array

  @Prop({ type: [QuestionSchema], required: true })
  round_2: Question[]; // "Questions of the Exam" Its an Array

  @Prop({ type: [QuestionSchema], required: true })
  round_3: Question[]; // "Questions of the Exam" Its an Array
}

export const ExamSchema = SchemaFactory.createForClass(Exam);
ExamSchema.set('minimize', true);