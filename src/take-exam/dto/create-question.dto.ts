import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { QuestionType } from 'src/common/enum/question-type.enum';


export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @IsString({ each: true })
  exam_options: string[];

  @IsEnum(QuestionType)
  question_type: QuestionType;

  @ValidateIf(o => o.question_type === QuestionType.SINGLE_CHOICE)
  @IsNumber()
  correct_options?: number;

  @ValidateIf(o => o.question_type === QuestionType.MULTIPLE_CHOICE)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  correct_multiple_options?: number[];

  @ValidateIf(o => o.question_type === QuestionType.TRUE_FALSE)
  @IsBoolean()
  correct_boolean_option?: boolean;
}
