import { Test, TestingModule } from '@nestjs/testing';
import { AiModelScraperController } from './ai-model-scraper.controller';
import { AiModelScraperService } from './ai-model-scraper.service';

describe('AiModelScraperController', () => {
  let controller: AiModelScraperController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiModelScraperController],
      providers: [AiModelScraperService],
    }).compile();

    controller = module.get<AiModelScraperController>(AiModelScraperController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
