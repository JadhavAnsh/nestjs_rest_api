import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { ExamLevel } from "src/common/enum/exam-level.enum";
import { CreateQuestionDto } from "./create-question.dto";

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  roadmap_ID: string;

  @IsString()
  @IsNotEmpty()
  exam_ID: string;

  @IsString()
  @IsNotEmpty()
  exam_title: string;

  @IsString()
  @IsOptional()
  exam_description?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  passing_score: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  exam_time: number;

  @IsEnum(ExamLevel)
  @IsNotEmpty()
  exam_levels: ExamLevel;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @IsNotEmpty()
  round_1: CreateQuestionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @IsNotEmpty()
  round_2: CreateQuestionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @IsNotEmpty()
  round_3: CreateQuestionDto[];
}