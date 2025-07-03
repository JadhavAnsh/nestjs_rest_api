import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document, Types } from "mongoose";

@Schema({ timestamps: true })
export class ExamProgress extends Document {
  @Prop({ required: true })
  totalQuestions: number;

  @Prop({required:true})
  correctQuestions: number;

  @Prop({ type: Boolean, default: false })
  hasStarted: boolean;

  @Prop({ type: Boolean, default: false })
  isCompleted: boolean;

  @Prop({ type: Number, default: 0 })
  percentage: number;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({
    type: {
      totalAttempts: { type: Number, default: 0 },
      lastAttemptedAt: { type: Date, default: null },
      maxPercentageAchieved: { type: Number, default: 0 },
      attemptLog: { type: [{ type: mongoose.Schema.Types.Mixed }], default: [] },
    },
  })
  assessment: {
    totalAttempts: number;
    lastAttemptedAt: Date | null;
    maxPercentageAchieved: number;
    attemptLog: any[];
  };
}

export const ExamProgressSchema = SchemaFactory.createForClass(ExamProgress);