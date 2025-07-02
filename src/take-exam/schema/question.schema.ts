import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { QuestionType } from 'src/common/enum/question-type.enum';

@Schema({ _id: false })
export class Question extends Document {
  @Prop({ required: true })
  question: string;

  @Prop({ type: [String], required: true })
  exam_options: string[];

  @Prop({ required: true, enum: QuestionType })
  question_type: QuestionType;

  @Prop({
    type: Number,
    required: function (this: Question) {
      return this.question_type === QuestionType.SINGLE_CHOICE;
    },
  })
  correct_options?: number;

  @Prop({
    type: [Number],
    required: function (this: Question) {
      return this.question_type === QuestionType.MULTIPLE_CHOICE;
    },
    validate: {
      validator: function (val: number[]) {
        if (this.question_type !== QuestionType.MULTIPLE_CHOICE) return true;
        return Array.isArray(val) && val.length === 2;
      },
      message: 'Multiple choice must have exactly 2 correct options',
    },
  })
  correct_multiple_options?: number[];

  @Prop({
    type: Boolean,
    required: function (this: Question) {
      return this.question_type === QuestionType.TRUE_FALSE;
    },
  })
  correct_boolean_option?: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
