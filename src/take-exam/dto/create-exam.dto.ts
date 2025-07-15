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

export class ReadUnitDto {
  @IsNotEmpty()
  @IsString()
  title: string;
}

export class ReadDto {
  @ValidateNested()
  @Type(() => ReadUnitDto)
  @IsNotEmpty()
  read: ReadUnitDto;
}

export class UnitDto {
  @IsNotEmpty()
  @IsString()
  unit_type: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadDto)
  @IsNotEmpty()
  subunit: ReadDto[];
}

export class ModuleDto {
  @IsNotEmpty()
  @IsString()
  module_title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnitDto)
  @IsNotEmpty()
  units: UnitDto[];
}

export class RoadmapDataDto {
  @IsNotEmpty()
  @IsString()
  roadmap_title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleDto)
  @IsNotEmpty()
  modules: ModuleDto[];
}

export class GenerateExamDto {
  @IsNotEmpty()
  @IsString()
  roadmapId: string;

  @IsNotEmpty()
  @IsString()
  examId: string;

  @ValidateNested()
  @Type(() => RoadmapDataDto)
  @IsNotEmpty()
  roadmapData: RoadmapDataDto;
}