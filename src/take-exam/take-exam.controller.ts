import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';
import { TakeExamService } from './take-exam.service';

@Controller('take-exam')
export class TakeExamController {
  constructor(private readonly takeExamService: TakeExamService) {}

  @Get()
  async getAllExams(): Promise<Exam[]> {
    return this.takeExamService.getAllExams();
  }

  @Get(':id')
  async getExamById(@Param('id') id: string): Promise<Exam> {
    return this.takeExamService.getExamById(id);
  }

  @Post()
  async createExam(@Body() createExamDto: CreateExamDto): Promise<Exam> {
    return this.takeExamService.createExam(createExamDto);
  }
}
