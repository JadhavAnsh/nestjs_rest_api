import { IsArray, IsEnum, IsNotEmpty, IsString, Validate } from 'class-validator';
import { QuestionType } from 'src/common/enum/question-type.enum';
import { CorrectOptionsValidator } from '../utils/correct_options_validator';

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

  @Validate(CorrectOptionsValidator)
  correct_options: number | number[];
}