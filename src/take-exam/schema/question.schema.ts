import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { QuestionType } from 'src/common/enum/question-type.enum';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ _id: false })
export class Question {
  @Prop({ required: true, trim: true, minlength: 1 })
  question: string; // "Questions for exam"

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
  exam_options: string[]; // "Options for each question"

  @Prop({ required: true, enum: QuestionType, index: true })
  question_type: QuestionType; // "Question type (single_choice, multiple_choice, true_false)"

  @Prop({
    type: [Number],
    required: true,
    validate: {
      validator: function (val: number[]) {
        if (this.question_type === QuestionType.SINGLE_CHOICE) {
          return Array.isArray(val) && val.length === 1 && val.every((v) => Number.isInteger(v) && v >= 0 && v < this.exam_options.length);
        }
        if (this.question_type === QuestionType.MULTIPLE_CHOICE) {
          return Array.isArray(val) && val.length === 2 && val.every((v) => Number.isInteger(v) && v >= 0 && v < this.exam_options.length);
        }
        if (this.question_type === QuestionType.TRUE_FALSE) {
          return Array.isArray(val) && val.length === 1 && val.every((v) => Number.isInteger(v) && v >= 0 && v < 2);
        }
        return false;
      },
      message: 'Invalid correct option indexes for the specified question type or out of bounds',
    },
  })
  correct_options: number[]; // "Correct option indexes"
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.set('minimize', true);