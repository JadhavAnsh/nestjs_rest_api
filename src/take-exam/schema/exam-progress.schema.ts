import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ExamProgress extends Document {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Exam' })
  examId: Types.ObjectId;

  @Prop({ required: true })
  total_questions: number;

  @Prop({ required: true })
  correct_questions: number;

  // @Prop({ type: Boolean, default: false })
  // has_started: boolean;

  @Prop({ type: Boolean, default: false })
  is_completed: boolean;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: Number, default: 0 })
  highest_percentage: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;//for apply thelogin on lock period

  @Prop({ type: Date, default: null })
  lastSubmittedAt: Date | null;

  @Prop({
    type: [{
      percentage: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now },
    }],
    default: [],
  })
  attempt_Log: { percentage: number; timestamp: Date }[];

  @Prop({
    type: [{
      questionId: { type: Types.ObjectId, required: true, ref: 'Question' }, // Ref to question
      selectedAnswer: { type: String, required: true }, // Answer selected by user
      correctAnswer: { type: String, required: true }, // Correct answer (from DB)
      isCorrect: { type: Boolean, required: true }, // Whether answer is correct
      timeTaken: { type: Number, default: 0 }, // Time taken to answer (optional)
      timestamp: { type: Date, default: Date.now }, // When the answer was submitted
    }],
    default: [],
  })
  answerLog: {
    questionId: Types.ObjectId;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timeTaken?: number;
    timestamp: Date;
  }[]; // Stores logs of every answered question
}

export type ExamProgressDocument = ExamProgress & Document;
export const ExamProgressSchema = SchemaFactory.createForClass(ExamProgress);