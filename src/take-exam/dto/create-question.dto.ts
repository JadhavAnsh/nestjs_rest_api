import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateIf,
} from 'class-validator';
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
  question_type: QuestionType;

  @ValidateIf((o) => o.question_type === QuestionType.SINGLE_CHOICE)
  @IsNumber()
  @Transform(({ obj }) =>
    obj.question_type === QuestionType.SINGLE_CHOICE
      ? Number(obj.correct_options)
      : undefined,
  )
  correct_options?: number;

  @ValidateIf((o) => o.question_type === QuestionType.MULTIPLE_CHOICE)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Transform(({ obj }) => {
    if (obj.question_type !== QuestionType.MULTIPLE_CHOICE) return undefined;
    const value = obj.correct_multiple_options;
    // Ensure the array is valid and contains exactly 2 numbers
    if (Array.isArray(value) && value.length === 2 && value.every((v: any) => typeof v === 'number')) {
      return value;
    }
    return undefined; // Set to undefined if invalid
  })
  correct_multiple_options?: number[];

  @ValidateIf((o) => o.question_type === QuestionType.TRUE_FALSE)
  @IsBoolean()
  @Transform(({ obj }) =>
    obj.question_type === QuestionType.TRUE_FALSE
      ? Boolean(obj.correct_boolean_option)
      : undefined,
  )
  correct_boolean_option?: boolean;
}