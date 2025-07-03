import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { QuestionType } from 'src/common/enum/question-type.enum';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ _id: false })
export class Question {
  @Prop({ required: true })
  question: string;

  @Prop({ type: [String], required: true, minlength: 1, maxlength: 4 })
  exam_options: string[];

  @Prop({ required: true, enum: QuestionType })
  question_type: QuestionType;

  @Prop({
    type: [Number],
    required: true,
    validate: {
      validator: function (val: number[]) {
        if (this.question_type === QuestionType.SINGLE_CHOICE) {
          return Array.isArray(val) && val.length === 1 && val.every((v) => Number.isInteger(v) && v >= 0 && v < this.exam_options.length);
        }
        if (this.question_type === QuestionType.MULTIPLE_CHOICE) {
          return Array.isArray(val) && val.length >= 2 && val.every((v) => Number.isInteger(v) && v >= 0 && v < this.exam_options.length);
        }
        if (this.question_type === QuestionType.TRUE_FALSE) {
          return Array.isArray(val) && val.length === 1 && val.every((v) => Number.isInteger(v) && v >= 0 && v < 2);
        }
        return false;
      },
      message: 'Invalid correct option indexes for the specified question type',
    },
  })
  correct_options: number[];
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.set('minimize', true);