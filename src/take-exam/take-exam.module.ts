import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exam, ExamSchema } from './schema/exam.schema';
import { ExamProgress, ExamProgressSchema } from './schema/exam-progress.schema';
import { TakeExamController } from './take-exam.controller';
import { TakeExamService } from './take-exam.service';
import { ExamProgressService } from './take-examProgress.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: ExamProgress.name, schema: ExamProgressSchema }
    ])
  ],
  controllers: [TakeExamController],
  providers: [TakeExamService, ExamProgressService],
})
export class TakeExamModule {}
