import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModelScraperController } from './ai-model-scraper.controller';
import { AiModelScraperService } from './ai-model-scraper.service';
import scrapingConfig from './config/scraping.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forFeature(scrapingConfig),
  ],
  controllers: [AiModelScraperController],
  providers: [AiModelScraperService],
})
export class AiModelScraperModule {}
