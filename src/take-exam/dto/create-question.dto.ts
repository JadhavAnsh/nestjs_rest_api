import { IsString, IsNotEmpty, IsNumber, IsEnum, IsArray, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ExamLevel } from 'src/common/enum/exam-level.enum';
import { QuestionType } from 'src/common/enum/question-type.enum';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  exam_options: string[];

  @IsEnum(QuestionType)
  @IsNotEmpty()
  question_type: QuestionType;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  correct_options: number[];
}