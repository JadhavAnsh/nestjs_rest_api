import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document, Types } from "mongoose";

@Schema({ timestamps: true })
export class ExamProgress extends Document {
  @Prop({
    type: {
      hasStarted: { type: Boolean, default: false },
      isCompleted: { type: Boolean, default: false },
      percentage: { type: Number, default: 0 },
      completedAt: { type: Date, default: null },
      isLearningMaterialCompleted: { type: Boolean, default: false },
      assessment: {
        type: {
          totalAttempts: { type: Number, default: 0 },
          lastAttemptedAt: { type: Date, default: null },
          maxPercentageAchieved: { type: Number, default: 0 },
          attemptLog: { type: [{ type: mongoose.Schema.Types.Mixed }], default: [] }
        }
      }
    }
  })
  progress: {
    hasStarted: boolean;
    isCompleted: boolean;
    percentage: number;
    completedAt: Date | null;
    isLearningMaterialCompleted: boolean;
    assessment: {
      totalAttempts: number;
      lastAttemptedAt: Date | null;
      maxPercentageAchieved: number;
      attemptLog: any[];
    };
  };
}

export const ExamProgressSchema = SchemaFactory.createForClass(ExamProgress);