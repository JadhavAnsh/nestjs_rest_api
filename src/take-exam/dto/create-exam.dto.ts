import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateQuestionDto } from './create-question.dto';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  ExamDomain?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  passingScore: number;

  @IsNumber()
  time: number;

  @IsString()
  @IsOptional()
  levels?: string;

  @IsArray()
  @IsOptional()
  QualificationTags?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  Questions: CreateQuestionDto[];
}
