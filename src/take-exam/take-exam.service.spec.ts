import { Test, TestingModule } from '@nestjs/testing';
import { TakeExamService } from './take-exam.service';

describe('TakeExamService', () => {
  let service: TakeExamService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TakeExamService],
    }).compile();

    service = module.get<TakeExamService>(TakeExamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
