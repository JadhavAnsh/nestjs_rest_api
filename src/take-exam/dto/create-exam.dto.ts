import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  ValidateNested
} from 'class-validator';
import { CreateQuestionDto } from './create-question.dto';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  examId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  ExamDomain?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  passingScore: number;

  @IsNumber()
  @IsNotEmpty()
  @Max(3)
  examAttempts: number;

  @IsNumber()
  @IsNotEmpty()
  time: number;

  @IsString()
  @IsNotEmpty()
  levels?: string;

  @IsArray()
  @IsNotEmpty()
  QualificationTags: string[];

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  Questions: CreateQuestionDto[];
}
