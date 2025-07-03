import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { QuestionType } from 'src/common/enum/question-type.enum';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ _id: false })
export class Question {
  @Prop({ required: true })
  question: string;

  @Prop({ type: [String], required: true })
  exam_options: string[];

  @Prop({ required: true, enum: QuestionType })
  question_type: QuestionType;

  @Prop()
  correct_options?: number;

  @Prop({
    type: [Number],
    default: undefined,
    validate: {
      validator: function (val: number[]) {
        if (this.question_type !== QuestionType.MULTIPLE_CHOICE) return true;
        return Array.isArray(val) && val.length === 2;
      },
      message: 'Multiple choice must have exactly 2 correct options',
    },
  })
  correct_multiple_options?: number[];

  @Prop()
  correct_boolean_option?: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.set('minimize', true); // ✅ removes undefined/null from subdocs
