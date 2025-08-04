import { Test, TestingModule } from '@nestjs/testing';
import { AiModelScraperService } from './ai-model-scraper.service';

describe('AiModelScraperService', () => {
  let service: AiModelScraperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiModelScraperService],
    }).compile();

    service = module.get<AiModelScraperService>(AiModelScraperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
