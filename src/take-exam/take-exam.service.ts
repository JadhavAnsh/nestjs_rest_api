import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExamLevel } from 'src/common/enum/exam-level.enum';
import { QuestionType } from 'src/common/enum/question-type.enum';
import { CreateExamDto, RoadmapDataDto } from './dto/create-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import {
  ExamProgress,
  ExamProgressDocument,
} from './schema/exam-progress.schema';
import { Exam } from './schema/exam.schema';

export interface ExamResponseDto {
  exam_ID: string;
  exam_title: string;
  exam_description: string;
  exam_time: number;
  passing_score: number;
  exam_levels: ExamLevel;
  tags: string[];
  round_name: string;
  questions: any[];
}

@Injectable()
export class TakeExamService {
  private readonly logger = new Logger(TakeExamService.name);
  private readonly genAI: GoogleGenerativeAI;

  // Updated constants for 300 questions per round
  private readonly QUESTIONS_PER_TYPE_PER_ROUND = 100; // 100 of each type per round
  private readonly TOTAL_QUESTIONS = 900; // 3 rounds × 300 questions

  private readonly SAMPLE_QUESTIONS_COUNT = 25; // Number of sample questions

  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    @InjectModel(ExamProgress.name)
    private readonly examProgressModel: Model<ExamProgressDocument>,
  ) {
    if (!process.env.GEMINI_API_KEY) {
      this.logger.error('GEMINI_API_KEY is not set in environment variables');
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  //for getting the exam Data , to submit the
  async findExamById(examId: string): Promise<Exam> {
    try {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(examId);
      let exam;
      if (isObjectId) {
        exam = await this.examModel.findById(examId).exec();
      } else {
        exam = await this.examModel.findOne({ exam_ID: examId }).exec();
      }
      if (!exam) {
        throw new NotFoundException(`Exam with ID ${examId} not found`);
      }
      return exam;
    } catch (error) {
      console.error('Error in findExamById:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve exam');
    }
  }

  async getExamByRoadmapId(roadmapId: string): Promise<ExamResponseDto> {
    try {
      this.logger.log(`Fetching exam for roadmap: ${roadmapId}`);

      // Step 1: Find the exam by roadmap_ID
      const exam = await this.examModel
        .findOne({ roadmap_ID: roadmapId })
        .exec();
      if (!exam) {
        throw new NotFoundException(
          `Exam with roadmap_ID ${roadmapId} not found`,
        );
      }

      // Step 2: Check if ExamProgress exists for this exam and user
      let examProgress = await this.examProgressModel
        .findOne({
          examId: exam.exam_ID,
        })
        .exec();

      // Step 3: Create ExamProgress if it doesn't exist
      if (!examProgress) {
        examProgress = new this.examProgressModel({
          examId: exam.exam_ID,
          total_questions: this.SAMPLE_QUESTIONS_COUNT,
          correct_questions: 0,
          has_started: false,
          is_completed: false,
          attempts: 1,
          highest_percentage: 0,
          lockUntil: null,
          lastSubmittedAt: null,
          attempt_Log: [],
          answerLog: [],
        });
        await examProgress.save();
        this.logger.log(`Created new ExamProgress for exam: ${exam.exam_ID}`);
      }

      // Step 4: Determine which round to use based on attempts
      const currentAttempt = examProgress.attempts;

      // Fix: Calculate round index properly to handle cycling through rounds 1, 2, 3
      let roundIndex: number;
      if (currentAttempt === 0) {
        roundIndex = 1; // Default to round 1 if attempts is 0
      } else {
        roundIndex = ((currentAttempt - 1) % 3) + 1;
      }

      let roundQuestions: any[];
      let roundName: string;

      switch (roundIndex) {
        case 1:
          roundQuestions = exam.round_1;
          roundName = 'round_1';
          break;
        case 2:
          roundQuestions = exam.round_2;
          roundName = 'round_2';
          break;
        case 3:
          roundQuestions = exam.round_3;
          roundName = 'round_3';
          break;
        default:
          roundQuestions = exam.round_1;
          roundName = 'round_1';
      }

      // Step 5: Get 25 random questions from the selected round using aggregation
      const selectedQuestions = await this.examModel
        .aggregate([
          { $match: { _id: exam._id } },
          { $unwind: `$${roundName}` },
          { $sample: { size: this.SAMPLE_QUESTIONS_COUNT } },
          { $replaceRoot: { newRoot: `$${roundName}` } },
        ])
        .exec();

      this.logger.log(
        `Selected ${selectedQuestions.length} questions from ${roundName} for attempt ${currentAttempt}`,
      );

      // Step 6: Prepare response
      const response: ExamResponseDto = {
        exam_ID: exam.exam_ID,
        exam_title: exam.exam_title,
        exam_description: exam.exam_description,
        exam_time: exam.exam_time,
        passing_score: exam.passing_score,
        exam_levels: exam.exam_levels,
        tags: exam.tags,
        round_name: roundName,
        questions: selectedQuestions,
      };

      return response;
    } catch (error) {
      this.logger.error(
        `Error in getExamByRoadmapIdForUser: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve exam with user progress',
      );
    }
  }

  async createExam(createExamDto: CreateExamDto): Promise<Exam> {
    try {
      // Check if exam_ID already exists
      const existingExam = await this.examModel
        .findOne({ exam_ID: createExamDto.exam_ID })
        .exec();
      if (existingExam) {
        this.logger.warn(
          `Exam with ID ${createExamDto.exam_ID} already exists`,
        );
        throw new ConflictException(
          `Exam with ID ${createExamDto.exam_ID} already exists`,
        );
      }

      const exam = new this.examModel({
        ...createExamDto,
        round_1: createExamDto.round_1.map((queuestion) => ({
          question: queuestion.question,
          exam_options: queuestion.exam_options,
          question_type: queuestion.question_type,
          correct_options: queuestion.correct_options,
        })),
        round_2: createExamDto.round_2.map((queuestion) => ({
          question: queuestion.question,
          exam_options: queuestion.exam_options,
          question_type: queuestion.question_type,
          correct_options: queuestion.correct_options,
        })),
        round_3: createExamDto.round_3.map((queuestion) => ({
          question: queuestion.question,
          exam_options: queuestion.exam_options,
          question_type: queuestion.question_type,
          correct_options: queuestion.correct_options,
        })),
      });

      const savedExam = await exam.save();
      this.logger.log(`Exam created successfully with ID ${savedExam.exam_ID}`);
      return savedExam;
    } catch (error) {
      this.logger.error(`Error creating exam: ${error.message}`, error.stack);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create exam');
    }
  }

  private generateRawQuestions(
    roadmapData: RoadmapDataDto,
  ): CreateQuestionDto[] {
    const questions: CreateQuestionDto[] = [];

    // Extract all topics from roadmap data
    const topics: string[] = [];
    roadmapData.modules.forEach((module) => {
      topics.push(module.module_title);
      module.units.forEach((unit) => {
        unit.subunit.forEach((subunit) => {
          topics.push(subunit.read.title);
        });
      });
    });

    // Generate 300 true/false questions (100 per round)
    for (let i = 0; i < 300; i++) {
      const topic = topics[i % topics.length];
      const question = this.generateTrueFalseQuestion(
        topic,
        roadmapData.roadmap_title,
      );
      questions.push(question);
    }

    // Generate 300 single choice questions (100 per round)
    for (let i = 0; i < 300; i++) {
      const topic = topics[i % topics.length];
      const question = this.generateSingleChoiceQuestion(
        topic,
        roadmapData.roadmap_title,
      );
      questions.push(question);
    }

    // Generate 300 multiple choice questions (100 per round)
    for (let i = 0; i < 300; i++) {
      const topic = topics[i % topics.length];
      const question = this.generateMultipleChoiceQuestion(
        topic,
        roadmapData.roadmap_title,
      );
      questions.push(question);
    }

    // Shuffle questions for variety
    const shuffledQuestions = this.shuffleArray(questions);

    this.logger.log(`Generated ${shuffledQuestions.length} questions`);
    return shuffledQuestions;
  }

  private generateTrueFalseQuestion(
    topic: string,
    roadmapTitle: string,
  ): CreateQuestionDto {
    const statements = [
      `${topic} is a fundamental concept in ${roadmapTitle}`,
      `Understanding ${topic} is essential for mastering ${roadmapTitle}`,
      `${topic} requires prior knowledge of advanced programming concepts`,
      `${topic} is typically covered in beginner-level courses`,
      `${topic} involves practical implementation exercises`,
      `${topic} is considered a core competency for ${roadmapTitle}`,
      `${topic} has direct applications in real-world scenarios`,
      `${topic} is built upon prerequisite knowledge of other modules`,
      `${topic} includes hands-on coding exercises`,
      `${topic} is essential for certification in ${roadmapTitle}`,
      `${topic} requires understanding of design patterns`,
      `${topic} focuses on theoretical concepts rather than practical skills`,
      `${topic} is primarily concerned with debugging techniques`,
      `${topic} emphasizes best practices and industry standards`,
      `${topic} involves collaborative development methodologies`,
    ];

    const statement = statements[Math.floor(Math.random() * statements.length)];
    const isTrue = Math.random() > 0.5;

    return {
      question: isTrue ? statement : `${statement} (This is incorrect)`,
      question_type: QuestionType.TRUE_FALSE,
      exam_options: ['True', 'False'],
      correct_options: isTrue ? 0 : 1,
    };
  }

  private generateSingleChoiceQuestion(
    topic: string,
    roadmapTitle: string,
  ): CreateQuestionDto {
    const questions = [
      `What is the primary purpose of ${topic}?`,
      `Which of the following best describes ${topic}?`,
      `When working with ${topic}, what is the most important consideration?`,
      `How does ${topic} relate to ${roadmapTitle}?`,
      `What is the main advantage of implementing ${topic}?`,
      `Which approach is recommended when learning ${topic}?`,
      `What prerequisite knowledge is required for ${topic}?`,
      `How should ${topic} be applied in production environments?`,
      `What is the key benefit of mastering ${topic}?`,
      `Which methodology works best with ${topic}?`,
      `What common mistake should be avoided when working with ${topic}?`,
      `How does ${topic} improve development efficiency?`,
      `What is the relationship between ${topic} and system architecture?`,
      `Which tool is most commonly used with ${topic}?`,
      `What performance considerations apply to ${topic}?`,
    ];

    const question = questions[Math.floor(Math.random() * questions.length)];
    const correctAnswers = [
      `${topic} is a core component that enables efficient development`,
      `${topic} provides essential functionality for ${roadmapTitle}`,
      `${topic} enhances code maintainability and scalability`,
      `${topic} offers robust solutions for common problems`,
      `${topic} integrates seamlessly with other components`,
      `${topic} follows industry-standard conventions`,
      `${topic} supports modern development practices`,
    ];

    const wrongAnswers = [
      `${topic} is primarily used for database management`,
      `${topic} is only relevant for advanced users`,
      `${topic} is deprecated and should be avoided`,
      `${topic} requires expensive third-party licenses`,
      `${topic} is incompatible with modern frameworks`,
      `${topic} has limited practical applications`,
      `${topic} is purely theoretical with no real-world use`,
    ];

    const correctAnswer =
      correctAnswers[Math.floor(Math.random() * correctAnswers.length)];
    const selectedWrongAnswers = this.shuffleArray(wrongAnswers).slice(0, 3);

    const options = [correctAnswer, ...selectedWrongAnswers];
    const shuffledOptions = this.shuffleArray(options);
    const correctIndex = shuffledOptions.indexOf(correctAnswer);

    return {
      question,
      question_type: QuestionType.SINGLE_CHOICE,
      exam_options: shuffledOptions,
      correct_options: correctIndex,
    };
  }

  private generateMultipleChoiceQuestion(
    topic: string,
    roadmapTitle: string,
  ): CreateQuestionDto {
    const questions = [
      `Which of the following are key aspects of ${topic}? (Select 2)`,
      `What are the main benefits of understanding ${topic}? (Select 2)`,
      `Which statements about ${topic} are correct? (Select 2)`,
      `What are the essential components of ${topic}? (Select 2)`,
      `Which best practices apply to ${topic}? (Select 2)`,
      `What are the primary use cases for ${topic}? (Select 2)`,
      `Which skills are developed through ${topic}? (Select 2)`,
      `What are the key advantages of ${topic}? (Select 2)`,
      `Which principles are fundamental to ${topic}? (Select 2)`,
      `What are the main features of ${topic}? (Select 2)`,
    ];

    const question = questions[Math.floor(Math.random() * questions.length)];
    const correctAnswers = [
      `${topic} improves code quality and maintainability`,
      `${topic} is essential for professional development`,
      `${topic} enhances system performance and reliability`,
      `${topic} facilitates team collaboration and communication`,
      `${topic} supports scalable application architecture`,
      `${topic} enables efficient problem-solving approaches`,
      `${topic} provides industry-standard implementation patterns`,
      `${topic} ensures robust error handling and debugging`,
    ];

    const wrongAnswers = [
      `${topic} is only used in legacy systems`,
      `${topic} requires expensive third-party tools`,
      `${topic} has limited scalability options`,
      `${topic} is incompatible with modern frameworks`,
      `${topic} increases development complexity unnecessarily`,
      `${topic} has poor documentation and community support`,
      `${topic} is primarily for academic purposes only`,
      `${topic} lacks industry adoption and support`,
    ];

    const selectedCorrectAnswers = this.shuffleArray(correctAnswers).slice(
      0,
      2,
    );
    const selectedWrongAnswers = this.shuffleArray(wrongAnswers).slice(0, 2);

    const options = [...selectedCorrectAnswers, ...selectedWrongAnswers];
    const shuffledOptions = this.shuffleArray(options);
    const correctIndices = selectedCorrectAnswers.map((answer) =>
      shuffledOptions.indexOf(answer),
    );

    return {
      question,
      question_type: QuestionType.MULTIPLE_CHOICE,
      exam_options: shuffledOptions,
      correct_options: correctIndices,
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private determineExamLevel(roadmapData: RoadmapDataDto): ExamLevel {
    const totalUnits = roadmapData.modules.reduce((total, module) => {
      return (
        total +
        module.units.reduce((unitTotal, unit) => {
          return unitTotal + unit.subunit.length;
        }, 0)
      );
    }, 0);

    // Determine level based on complexity
    if (totalUnits <= 4) {
      return ExamLevel.EASY;
    } else if (totalUnits <= 8) {
      return ExamLevel.MEDIUM;
    } else {
      return ExamLevel.HARD;
    }
  }

  private refineQuestionsToExamStructure(params: {
    roadmapId: string;
    examId: string;
    roadmapData: RoadmapDataDto;
    rawQuestions: CreateQuestionDto[];
  }): CreateExamDto {
    const { roadmapId, examId, roadmapData, rawQuestions } = params;

    if (rawQuestions.length !== this.TOTAL_QUESTIONS) {
      throw new Error(
        `Expected ${this.TOTAL_QUESTIONS} questions, received ${rawQuestions.length}`,
      );
    }

    // Group questions by type
    const trueFalseQuestions = rawQuestions.filter(
      (q) => q.question_type === QuestionType.TRUE_FALSE,
    );
    const singleChoiceQuestions = rawQuestions.filter(
      (q) => q.question_type === QuestionType.SINGLE_CHOICE,
    );
    const multipleChoiceQuestions = rawQuestions.filter(
      (q) => q.question_type === QuestionType.MULTIPLE_CHOICE,
    );

    // Distribute questions evenly across rounds (100 of each type per round)
    const round_1: CreateQuestionDto[] = [
      ...trueFalseQuestions.slice(0, this.QUESTIONS_PER_TYPE_PER_ROUND),
      ...singleChoiceQuestions.slice(0, this.QUESTIONS_PER_TYPE_PER_ROUND),
      ...multipleChoiceQuestions.slice(0, this.QUESTIONS_PER_TYPE_PER_ROUND),
    ];

    const round_2: CreateQuestionDto[] = [
      ...trueFalseQuestions.slice(
        this.QUESTIONS_PER_TYPE_PER_ROUND,
        this.QUESTIONS_PER_TYPE_PER_ROUND * 2,
      ),
      ...singleChoiceQuestions.slice(
        this.QUESTIONS_PER_TYPE_PER_ROUND,
        this.QUESTIONS_PER_TYPE_PER_ROUND * 2,
      ),
      ...multipleChoiceQuestions.slice(
        this.QUESTIONS_PER_TYPE_PER_ROUND,
        this.QUESTIONS_PER_TYPE_PER_ROUND * 2,
      ),
    ];

    const round_3: CreateQuestionDto[] = [
      ...trueFalseQuestions.slice(
        this.QUESTIONS_PER_TYPE_PER_ROUND * 2,
        this.QUESTIONS_PER_TYPE_PER_ROUND * 3,
      ),
      ...singleChoiceQuestions.slice(
        this.QUESTIONS_PER_TYPE_PER_ROUND * 2,
        this.QUESTIONS_PER_TYPE_PER_ROUND * 3,
      ),
      ...multipleChoiceQuestions.slice(
        this.QUESTIONS_PER_TYPE_PER_ROUND * 2,
        this.QUESTIONS_PER_TYPE_PER_ROUND * 3,
      ),
    ];

    // Shuffle each round for variety
    const shuffledRound1 = this.shuffleArray(round_1);
    const shuffledRound2 = this.shuffleArray(round_2);
    const shuffledRound3 = this.shuffleArray(round_3);

    // Generate tags from roadmap data
    const tags = [
      roadmapData.roadmap_title,
      ...roadmapData.modules.slice(0, 3).map((module) => module.module_title),
    ].filter((tag) => tag && tag.length > 0);

    // Determine exam level based on roadmap complexity
    const examLevel = this.determineExamLevel(roadmapData);

    const structuredExam: CreateExamDto = {
      roadmap_ID: roadmapId,
      exam_ID: examId,
      exam_title: `${roadmapData.roadmap_title} Comprehensive Exam`,
      exam_description: `A comprehensive exam covering all modules and units of ${roadmapData.roadmap_title}. This exam tests your understanding of key concepts and practical application skills across ${this.TOTAL_QUESTIONS} questions in 3 rounds.`,
      passing_score: 70,
      exam_time: 120,
      exam_levels: examLevel,
      tags,
      round_1: shuffledRound1,
      round_2: shuffledRound2,
      round_3: shuffledRound3,
    };

    return structuredExam;
  }

  async generateExamWithAI(
    roadmapId: string,
    examId: string,
    roadmapData: RoadmapDataDto,
  ): Promise<any> {
    try {
      this.logger.log(
        `Starting AI-powered exam generation for roadmap: ${roadmapId}`,
      );

      // Step 1: Generate raw questions using local generation
      const rawQuestions = this.generateRawQuestions(roadmapData);
      this.logger.log(`Generated ${rawQuestions.length} raw questions`);

      // Step 2: Refine questions to exam structure
      const examStructure = this.refineQuestionsToExamStructure({
        roadmapId,
        examId,
        roadmapData,
        rawQuestions,
      });

    // Step 3: Enhance questions with Gemini AI (process in batches due to large number of questions)
    const enhancedExam = await this.enhanceExamWithGemini(examStructure, roadmapData);

    const createExamResponse = await this.createExam(enhancedExam);
    
    // Step 4: Return exam as JSON response instead of saving to database
    // const examResponse = {
    //   roadmap_ID: roadmapId,
    //   exam_ID: examId,
    //   exam_title: enhancedExam.exam_title,
    //   exam_description: enhancedExam.exam_description,
    //   exam_levels: enhancedExam.exam_levels,
    //   passing_score: enhancedExam.passing_score,
    //   exam_time: enhancedExam.exam_time,
    //   tags: enhancedExam.tags,
    //   round_1: enhancedExam.round_1,
    //   round_2: enhancedExam.round_2,
    //   round_3: enhancedExam.round_3,
    // };
    
    this.logger.log(`Successfully generated exam with ID: ${createExamResponse.exam_ID}`);
    return createExamResponse;

  } catch (error) {
    this.logger.error(`Error in generateExamWithAI: ${error.message}`, error.stack);
    throw new InternalServerErrorException('Failed to generate exam with AI');
  }
}

  private async enhanceExamWithGemini(
    examStructure: CreateExamDto,
    roadmapData: RoadmapDataDto,
  ): Promise<CreateExamDto> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      // Process each round separately due to the large number of questions
      const enhancedRounds = await Promise.all([
        this.enhanceRoundWithGemini(
          model,
          examStructure.round_1,
          roadmapData,
          1,
        ),
        this.enhanceRoundWithGemini(
          model,
          examStructure.round_2,
          roadmapData,
          2,
        ),
        this.enhanceRoundWithGemini(
          model,
          examStructure.round_3,
          roadmapData,
          3,
        ),
      ]);

      const enhancedExam: CreateExamDto = {
        ...examStructure,
        round_1: enhancedRounds[0],
        round_2: enhancedRounds[1],
        round_3: enhancedRounds[2],
      };

      this.logger.log('Successfully enhanced exam with Gemini AI');
      return enhancedExam;
    } catch (error) {
      this.logger.warn(
        `Gemini enhancement failed, using original structure: ${error.message}`,
      );
      // Fallback to original structure if AI enhancement fails
      return examStructure;
    }
  }

  private async enhanceRoundWithGemini(
    model: any,
    roundQuestions: CreateQuestionDto[],
    roadmapData: RoadmapDataDto,
    roundNumber: number,
  ): Promise<CreateQuestionDto[]> {
    try {
      // Process questions in smaller batches to avoid token limits
      const batchSize = 50;
      const enhancedQuestions: CreateQuestionDto[] = [];

      for (let i = 0; i < roundQuestions.length; i += batchSize) {
        const batch = roundQuestions.slice(i, i + batchSize);
        const prompt = this.createGeminiBatchPrompt(
          batch,
          roadmapData,
          roundNumber,
          i / batchSize + 1,
        );

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const enhancedBatch = this.parseGeminiBatchResponse(
          response.text(),
          batch,
        );

        enhancedQuestions.push(...enhancedBatch);

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return enhancedQuestions;
    } catch (error) {
      this.logger.warn(
        `Failed to enhance round ${roundNumber}: ${error.message}`,
      );
      return roundQuestions;
    }
  }

  private createGeminiBatchPrompt(
    questions: CreateQuestionDto[],
    roadmapData: RoadmapDataDto,
    roundNumber: number,
    batchNumber: number,
  ): string {
    const topicsContext = roadmapData.modules.map((module) => ({
      module: module.module_title,
      topics: module.units.flatMap((unit) =>
        unit.subunit.map((sub) => sub.read.title),
      ),
    }));

    return `
You are an expert educational content creator. I have a batch of ${questions.length} questions for Round ${roundNumber} (Batch ${batchNumber}) about "${roadmapData.roadmap_title}".

ROADMAP CONTEXT:
${JSON.stringify(topicsContext, null, 2)}

TASK: Enhance these questions to be more educational, accurate, and challenging while maintaining the exact structure.

REQUIREMENTS:
1. Keep the exact same number of questions (${questions.length})
2. Maintain question types: true_false, single_choice, multiple_choice
3. Ensure questions are directly related to the roadmap topics
4. Make questions more specific and educational
5. Improve answer options to be more realistic and challenging
6. Return only the enhanced questions array in JSON format

CURRENT QUESTIONS BATCH:
${JSON.stringify(questions.slice(0, 5), null, 2)}...

Return ONLY a JSON array of enhanced questions maintaining the exact same format:
[
  {
    "question": "enhanced question text",
    "question_type": "true_false|single_choice|multiple_choice",
    "exam_options": ["option1", "option2", ...],
    "correct_options": index_or_array_of_indices
  },
  ...
]
`;
  }

  private parseGeminiBatchResponse(
    geminiResponse: string,
    originalQuestions: CreateQuestionDto[],
  ): CreateQuestionDto[] {
    try {
      // Clean the response to extract JSON
      const jsonMatch = geminiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in Gemini response');
      }

      const enhancedQuestions = JSON.parse(jsonMatch[0]);

      // Validate the enhanced questions
      if (
        !Array.isArray(enhancedQuestions) ||
        enhancedQuestions.length !== originalQuestions.length
      ) {
        throw new Error('Invalid enhanced questions format or count');
      }

      return enhancedQuestions.map((q, index) => ({
        question: q.question || originalQuestions[index].question,
        question_type:
          q.question_type || originalQuestions[index].question_type,
        exam_options: q.exam_options || originalQuestions[index].exam_options,
        correct_options:
          q.correct_options !== undefined
            ? q.correct_options
            : originalQuestions[index].correct_options,
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to parse Gemini batch response: ${error.message}`,
      );
      return originalQuestions;
    }
  }
}