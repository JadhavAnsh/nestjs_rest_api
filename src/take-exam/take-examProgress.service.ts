import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Exam } from "./schema/exam.schema";
import { ExamProgress } from "./schema/exam-progress.schema";

@Injectable()
export class TakeExamProgressService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    @InjectModel(ExamProgress.name) private readonly examProgressModel: Model<ExamProgress>,
  ) {}

  // Save or update progress based on examId only
  async saveOrUpdateProgress(examProgressData: any) {
    const {
      examId,
      totalQuestions,
      correctQuestions,
      hasStarted,
      isCompleted,
      percentage,
      completedAt,
      assessment,
    } = examProgressData;

    if (!examId) {
      throw new Error("examId is required");
    }

    // Find existing progress by examId only
    let progress = await this.examProgressModel.findOne({ examId });

    if (progress) {
      if (progress.assessment.totalAttempts >= 3) {
        throw new Error("Maximum number of attempts reached");
      }

      // Update existing progress
      progress.totalQuestions = totalQuestions ?? progress.totalQuestions;
      progress.correctQuestions = correctQuestions ?? progress.correctQuestions;
      progress.hasStarted = hasStarted ?? progress.hasStarted;
      progress.isCompleted = isCompleted ?? progress.isCompleted;
      progress.percentage = percentage ?? progress.percentage;
      progress.completedAt = completedAt ?? progress.completedAt;

      // Update assessment
      progress.assessment.totalAttempts += 1;
      progress.assessment.lastAttemptedAt = new Date();

      if (!progress.assessment.attemptLog) {
        progress.assessment.attemptLog = [];
      }

      progress.assessment.attemptLog.push({
        attemptedAt: new Date(),
        percentage,
        correctQuestions,
        totalQuestions,
      });

      if (percentage > progress.assessment.maxPercentageAchieved) {
        progress.assessment.maxPercentageAchieved = percentage;
      }

      await progress.save();
      return progress;
    } else {
      // Create new progress
      const newProgress = new this.examProgressModel({
        examId,
        totalQuestions,
        correctQuestions,
        hasStarted,
        isCompleted,
        percentage,
        completedAt,
        assessment: {
          totalAttempts: 1,
          lastAttemptedAt: new Date(),
          maxPercentageAchieved: percentage,
          attemptLog: [
            {
              attemptedAt: new Date(),
              percentage,
              correctQuestions,
              totalQuestions,
            },
          ],
        },
      });

      await newProgress.save();
      return newProgress;
    }
  }
}
