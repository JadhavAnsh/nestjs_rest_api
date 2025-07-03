import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document, Types } from "mongoose";

@Schema({timestamps :true})
export class examProgress extends Document {
    @Prop({ type:mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({type: mongoose.Schema.Types.ObjectId, ref: 'Exam' , required: true  })    
    examId : Types.ObjectId ;

    @Prop({ required: true })
    totalQuestions: number;

    @Prop({required:true})
    correctQuestions: number;

    @Prop({default:false})
    completed:boolean; 
    
    @Prop({default:0})
    score: number ;

    @Prop ({default:1})
    attempt: number ;
} 

export const examProgressSchema = SchemaFactory.createForClass(examProgress);
 