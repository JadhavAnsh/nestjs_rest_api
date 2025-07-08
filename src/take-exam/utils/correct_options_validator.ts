import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { QuestionType } from "src/common/enum/question-type.enum";
import { CreateQuestionDto } from "../dto/create-question.dto";

@ValidatorConstraint({ name: 'correctOptionsValidator', async: false })
export class CorrectOptionsValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as CreateQuestionDto;
    const { question_type, exam_options } = dto;

    if (question_type === QuestionType.SINGLE_CHOICE || question_type === QuestionType.TRUE_FALSE) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= exam_options.length) {
        return false;
      }
    } else if (question_type === QuestionType.MULTIPLE_CHOICE) {
      if (!Array.isArray(value) || value.length === 0 || !value.every(v => Number.isInteger(v) && v >= 0 && v < exam_options.length)) {
        return false;
      }
    } else {
      return false;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const dto = args.object as CreateQuestionDto;
    const { question_type } = dto;
    if (question_type === QuestionType.SINGLE_CHOICE || question_type === QuestionType.TRUE_FALSE) {
      return 'correct_options must be an integer between 0 and exam_options.length - 1';
    } else if (question_type === QuestionType.MULTIPLE_CHOICE) {
      return 'correct_options must be a non-empty array of integers, each between 0 and exam_options.length - 1';
    }
    return 'Invalid question_type';
  }
}