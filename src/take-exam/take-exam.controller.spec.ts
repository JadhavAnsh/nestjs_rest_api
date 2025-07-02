import { Test, TestingModule } from '@nestjs/testing';
import { TakeExamController } from './take-exam.controller';
import { TakeExamService } from './take-exam.service';

describe('TakeExamController', () => {
  let controller: TakeExamController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TakeExamController],
      providers: [TakeExamService],
    }).compile();

    controller = module.get<TakeExamController>(TakeExamController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
