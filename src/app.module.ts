import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TakeExamModule } from './take-exam/take-exam.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    //  Load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    //  Connect to MongoDB using Mongoose
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'), // reads from .env
      }),
    }),

    UsersModule,
    TakeExamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
