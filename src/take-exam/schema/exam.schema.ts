import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Question, QuestionSchema } from './question.schema';

@Schema()
export class Exam extends Document {
  @Prop({ required: true })
  title: string;

  @Prop()
  ExamDomain: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  passingScore: number;

  @Prop({ required: true, max: 3 })
  examAttempts: number;

  @Prop({ required: true })
  time: number;

  @Prop()
  levels: string;

  @Prop({ type: [String] })
  QualificationTags: string[];

  @Prop({ type: [QuestionSchema], required: true })
  Questions: Question[];
}

export const ExamSchema = SchemaFactory.createForClass(Exam);
