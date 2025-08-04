import { Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AiModelScraperService } from './ai-model-scraper.service';
import { ScrapingResult } from './interface/ai-model.interface';

@Controller('ai-model-scraper')
export class AiModelScraperController {
  constructor(private readonly aiModelScraperService: AiModelScraperService) {}

  @Get('run')
  async runScraper(): Promise<ScrapingResult> {
    try {
      return await this.aiModelScraperService.runScraping();
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Scraping failed',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('run')
  async triggerScraping(): Promise<{ message: string; timestamp: string }> {
    try {
      // Trigger async scraping
      this.aiModelScraperService.runScraping().catch(error => {
        console.error('Background scraping failed:', error);
      });
      
      return {
        message: 'Scraping job triggered successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to trigger scraping',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
