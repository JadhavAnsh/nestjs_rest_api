import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exam, ExamSchema } from './schema/exam.schema';
import { TakeExamController } from './take-exam.controller';
import { TakeExamService } from './take-exam.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }])
  ],
  controllers: [TakeExamController],
  providers: [TakeExamService],
})
export class TakeExamModule {}
