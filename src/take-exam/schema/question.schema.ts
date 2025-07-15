import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { QuestionType } from 'src/common/enum/question-type.enum';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ _id: true })
export class Question {
  @Prop({ required: true, trim: true, minlength: 1 })
  question: string;

  @Prop({
    type: [String],
    required: true,
    minlength: 1,
    maxlength: 4,
    validate: {
      validator: (options: string[]) => options.every((opt) => opt.trim().length > 0),
      message: 'Exam options cannot be empty strings',
    },
  })
  exam_options: string[];

  @Prop({ required: true, enum: QuestionType, index: true })
  question_type: QuestionType;

  @Prop({
  type: SchemaTypes.Mixed,
  required: true,
  validate: {
    validator: function (value: number | number[]) {
      if (
        this.question_type === QuestionType.SINGLE_CHOICE ||
        this.question_type === QuestionType.TRUE_FALSE
      ) {
        return (
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 0 &&
          value < this.exam_options.length
        );
      } else if (this.question_type === QuestionType.MULTIPLE_CHOICE) {
        return (
          Array.isArray(value) &&
          value.length === 2 && 
          value.every(
            (v) =>
              Number.isInteger(v) &&
              v >= 0 &&
              v < this.exam_options.length
          )
        );
      }
      return false;
    },
    message:
      'Invalid type or value for correct_options based on question_type',
  },
})
correct_options: number | number[];

}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.set('minimize', true);