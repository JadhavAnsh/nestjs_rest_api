import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ExamProgress extends Document {
  @Prop({ type: String, required: true }) // Changed to String to match exam_ID
  examId: string;

  @Prop({ required: true })
  total_questions: number;

  @Prop({ required: true })
  correct_questions: number;

  @Prop({ type: Boolean, default: false })
  has_started: boolean;

  @Prop({ type: Boolean, default: false })
  is_completed: boolean;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: Number, default: 0 })
  highest_percentage: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;//for apply th elogin on lock period

  @Prop({
    type: [{
      percentage: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now },
    }],
    default: [],
  })
  attempt_Log: { percentage: number; timestamp: Date }[];
}

export type ExamProgressDocument = ExamProgress & Document;
export const ExamProgressSchema = SchemaFactory.createForClass(ExamProgress);