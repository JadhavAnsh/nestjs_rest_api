import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Validate,
} from 'class-validator';
import { QuestionType } from 'src/common/enum/question-type.enum';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  exam_options: string[];

  @IsEnum(QuestionType)
  question_type: QuestionType;

  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ obj, value }) => {
    if (!Array.isArray(value)) return undefined;
    return value.map((v: any) => Number(v)).filter((v: number) => Number.isInteger(v));
  })
  @Validate((o) => {
    if (o.question_type === QuestionType.SINGLE_CHOICE) {
      return Array.isArray(o.correct_option_indexes) && o.correct_option_indexes.length === 1;
    }
    if (o.question_type === QuestionType.MULTIPLE_CHOICE) {
      return Array.isArray(o.correct_option_indexes) && o.correct_option_indexes.length >= 2;
    }
    if (o.question_type === QuestionType.TRUE_FALSE) {
      return Array.isArray(o.correct_option_indexes) && o.correct_option_indexes.length === 1 && o.correct_option_indexes.every((v: number) => v >= 0 && v < 2);
    }
    return false;
  }, { message: 'Invalid correct options for the specified question type' })
  correct_options: number[];
}