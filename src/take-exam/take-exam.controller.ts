import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';
import { TakeExamService } from './take-exam.service';
import { TakeExamProgressService } from './take-examProgress.service';

@Controller('take-exam')
export class TakeExamController {
  constructor(
    private readonly takeExamService: TakeExamService,
    private readonly takeExamProgressService: TakeExamProgressService,
  ) {}

  @Get()
  async getAllExams(): Promise<Exam[]> {
    return this.takeExamService.getAllExams();
  }

  //GET the progress responce in the baesd of iD 
 @Get('progress/:examId')
async getExamProgress(@Param('examId') examId: string) {
  console.log('Received examId:', examId); // Debug log
  if (!examId) {
    throw new BadRequestException('examID is required');
  }
  return this.takeExamProgressService.getProgressDetails(examId);
}


  @Get(':id')
  async getExamById(@Param('id') id: string): Promise<Exam> {
    return this.takeExamService.getExamById(id);
  }

  @Post()
  async createExam(@Body() createExamDto: CreateExamDto): Promise<Exam> {
    return this.takeExamService.createExam(createExamDto);
  }

 // todo for the create and saved process
  // // POST to create or update progress (userID + examID)
  // @Post('progress')
  // async submitExamProgress(
  //   @Body() body: { userID: string; examID: string },
  // ) {
  //   if (!body.userID || !body.examID) {
  //     throw new BadRequestException('userID and examID are required');
  //   }
  //   return this.takeExamProgressService.submitProgress(body);
  // }
}
