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
import { Exam } from './schema/exam.schema';

@Injectable()
export class TakeExamService {
  private readonly logger = new Logger(TakeExamService.name);
  private readonly genAI: GoogleGenerativeAI;
  
  // Updated constants for 300 questions per round
  private readonly QUESTIONS_PER_ROUND = 300;
  private readonly QUESTIONS_PER_TYPE_PER_ROUND = 100; // 100 of each type per round
  private readonly TOTAL_QUESTIONS = 900; // 3 rounds × 300 questions

  constructor(@InjectModel(Exam.name) private readonly examModel: Model<Exam>) {
    if (!process.env.GEMINI_API_KEY) {
      this.logger.error('GEMINI_API_KEY is not set in environment variables');
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async getExamByRoadmapId(roadmapId: string): Promise<Exam> {
    try {
      const exams = await this.examModel.aggregate([
        { $match: { roadmap_ID: roadmapId } },
        { $unwind: '$round_1' },
        { $unwind: '$round_2' },
        { $unwind: '$round_3' },
        { $sample: { size: 10 } },
        {
          $group: {
            _id: '$_id',
            roadmap_ID: { $first: '$roadmap_ID' },
            exam_ID: { $first: '$exam_ID' },
            exam_title: { $first: '$exam_title' },
            exam_description: { $first: '$exam_description' },
            passing_score: { $first: '$passing_score' },
            exam_time: { $first: '$exam_time' },
            exam_levels: { $first: '$exam_levels' },
            tags: { $first: '$tags' },
            round_1: { $push: '$round_1' },
            round_2: { $push: '$round_2' },
            round_3: { $push: '$round_3' },
          },
        },
      ]);

      if (!exams || exams.length === 0) {
        throw new NotFoundException(
          `Exam with roadmap_ID ${roadmapId} not found`,
        );
      }

      return exams[0];
    } catch (error) {
      this.logger.error(
        `Error retrieving exam for roadmap_ID ${roadmapId}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve exam');
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

      // Create exam with validated DTO
      const exam = new this.examModel(createExamDto);

      // Save to database
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

  private generateRawQuestions(roadmapData: RoadmapDataDto): CreateQuestionDto[] {
    const questions: CreateQuestionDto[] = [];
    
    // Extract all topics from roadmap data
    const topics: string[] = [];
    roadmapData.modules.forEach(module => {
      topics.push(module.module_title);
      module.units.forEach(unit => {
        unit.subunit.forEach(subunit => {
          topics.push(subunit.read.title);
        });
      });
    });

    // Generate 300 true/false questions (100 per round)
    for (let i = 0; i < 300; i++) {
      const topic = topics[i % topics.length];
      const question = this.generateTrueFalseQuestion(topic, roadmapData.roadmap_title);
      questions.push(question);
    }

    // Generate 300 single choice questions (100 per round)
    for (let i = 0; i < 300; i++) {
      const topic = topics[i % topics.length];
      const question = this.generateSingleChoiceQuestion(topic, roadmapData.roadmap_title);
      questions.push(question);
    }

    // Generate 300 multiple choice questions (100 per round)
    for (let i = 0; i < 300; i++) {
      const topic = topics[i % topics.length];
      const question = this.generateMultipleChoiceQuestion(topic, roadmapData.roadmap_title);
      questions.push(question);
    }

    // Shuffle questions for variety
    const shuffledQuestions = this.shuffleArray(questions);

    this.logger.log(`Generated ${shuffledQuestions.length} questions`);
    return shuffledQuestions;
  }

  private generateTrueFalseQuestion(topic: string, roadmapTitle: string): CreateQuestionDto {
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
      `${topic} involves collaborative development methodologies`
    ];

    const statement = statements[Math.floor(Math.random() * statements.length)];
    const isTrue = Math.random() > 0.5;
    
    return {
      question: isTrue ? statement : `${statement} (This is incorrect)`,
      question_type: QuestionType.TRUE_FALSE,
      exam_options: ["True", "False"],
      correct_options: isTrue ? 0 : 1
    };
  }

  private generateSingleChoiceQuestion(topic: string, roadmapTitle: string): CreateQuestionDto {
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
      `What performance considerations apply to ${topic}?`
    ];

    const question = questions[Math.floor(Math.random() * questions.length)];
    const correctAnswers = [
      `${topic} is a core component that enables efficient development`,
      `${topic} provides essential functionality for ${roadmapTitle}`,
      `${topic} enhances code maintainability and scalability`,
      `${topic} offers robust solutions for common problems`,
      `${topic} integrates seamlessly with other components`,
      `${topic} follows industry-standard conventions`,
      `${topic} supports modern development practices`
    ];
    
    const wrongAnswers = [
      `${topic} is primarily used for database management`,
      `${topic} is only relevant for advanced users`,
      `${topic} is deprecated and should be avoided`,
      `${topic} requires expensive third-party licenses`,
      `${topic} is incompatible with modern frameworks`,
      `${topic} has limited practical applications`,
      `${topic} is purely theoretical with no real-world use`
    ];

    const correctAnswer = correctAnswers[Math.floor(Math.random() * correctAnswers.length)];
    const selectedWrongAnswers = this.shuffleArray(wrongAnswers).slice(0, 3);
    
    const options = [correctAnswer, ...selectedWrongAnswers];
    const shuffledOptions = this.shuffleArray(options);
    const correctIndex = shuffledOptions.indexOf(correctAnswer);

    return {
      question,
      question_type: QuestionType.SINGLE_CHOICE,
      exam_options: shuffledOptions,
      correct_options: correctIndex
    };
  }

  private generateMultipleChoiceQuestion(topic: string, roadmapTitle: string): CreateQuestionDto {
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
      `What are the main features of ${topic}? (Select 2)`
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
      `${topic} ensures robust error handling and debugging`
    ];
    
    const wrongAnswers = [
      `${topic} is only used in legacy systems`,
      `${topic} requires expensive third-party tools`,
      `${topic} has limited scalability options`,
      `${topic} is incompatible with modern frameworks`,
      `${topic} increases development complexity unnecessarily`,
      `${topic} has poor documentation and community support`,
      `${topic} is primarily for academic purposes only`,
      `${topic} lacks industry adoption and support`
    ];

    const selectedCorrectAnswers = this.shuffleArray(correctAnswers).slice(0, 2);
    const selectedWrongAnswers = this.shuffleArray(wrongAnswers).slice(0, 2);
    
    const options = [...selectedCorrectAnswers, ...selectedWrongAnswers];
    const shuffledOptions = this.shuffleArray(options);
    const correctIndices = selectedCorrectAnswers.map(answer => shuffledOptions.indexOf(answer));

    return {
      question,
      question_type: QuestionType.MULTIPLE_CHOICE,
      exam_options: shuffledOptions,
      correct_options: correctIndices
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
      return total + module.units.reduce((unitTotal, unit) => {
        return unitTotal + unit.subunit.length;
      }, 0);
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
      throw new Error(`Expected ${this.TOTAL_QUESTIONS} questions, received ${rawQuestions.length}`);
    }

    // Group questions by type
    const trueFalseQuestions = rawQuestions.filter(q => q.question_type === QuestionType.TRUE_FALSE);
    const singleChoiceQuestions = rawQuestions.filter(q => q.question_type === QuestionType.SINGLE_CHOICE);
    const multipleChoiceQuestions = rawQuestions.filter(q => q.question_type === QuestionType.MULTIPLE_CHOICE);

    // Distribute questions evenly across rounds (100 of each type per round)
    const round_1: CreateQuestionDto[] = [
      ...trueFalseQuestions.slice(0, this.QUESTIONS_PER_TYPE_PER_ROUND),
      ...singleChoiceQuestions.slice(0, this.QUESTIONS_PER_TYPE_PER_ROUND),
      ...multipleChoiceQuestions.slice(0, this.QUESTIONS_PER_TYPE_PER_ROUND)
    ];

    const round_2: CreateQuestionDto[] = [
      ...trueFalseQuestions.slice(this.QUESTIONS_PER_TYPE_PER_ROUND, this.QUESTIONS_PER_TYPE_PER_ROUND * 2),
      ...singleChoiceQuestions.slice(this.QUESTIONS_PER_TYPE_PER_ROUND, this.QUESTIONS_PER_TYPE_PER_ROUND * 2),
      ...multipleChoiceQuestions.slice(this.QUESTIONS_PER_TYPE_PER_ROUND, this.QUESTIONS_PER_TYPE_PER_ROUND * 2)
    ];

    const round_3: CreateQuestionDto[] = [
      ...trueFalseQuestions.slice(this.QUESTIONS_PER_TYPE_PER_ROUND * 2, this.QUESTIONS_PER_TYPE_PER_ROUND * 3),
      ...singleChoiceQuestions.slice(this.QUESTIONS_PER_TYPE_PER_ROUND * 2, this.QUESTIONS_PER_TYPE_PER_ROUND * 3),
      ...multipleChoiceQuestions.slice(this.QUESTIONS_PER_TYPE_PER_ROUND * 2, this.QUESTIONS_PER_TYPE_PER_ROUND * 3)
    ];

    // Shuffle each round for variety
    const shuffledRound1 = this.shuffleArray(round_1);
    const shuffledRound2 = this.shuffleArray(round_2);
    const shuffledRound3 = this.shuffleArray(round_3);

    // Generate tags from roadmap data
    const tags = [
      roadmapData.roadmap_title,
      ...roadmapData.modules.slice(0, 3).map(module => module.module_title)
    ].filter(tag => tag && tag.length > 0);

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
      round_3: shuffledRound3
    };

    return structuredExam;
  }

  async generateExamWithAI(
    roadmapId: string,
    examId: string,
    roadmapData: RoadmapDataDto,
  ): Promise<Exam> {
    try {
      this.logger.log(`Starting AI-powered exam generation for roadmap: ${roadmapId}`);

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
      
      // Step 4: Create and save exam to database
      const createdExam = await this.createExam(enhancedExam);
      
      this.logger.log(`Successfully created exam with ID: ${createdExam.exam_ID}`);
      return createdExam;

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
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Process each round separately due to the large number of questions
      const enhancedRounds = await Promise.all([
        this.enhanceRoundWithGemini(model, examStructure.round_1, roadmapData, 1),
        this.enhanceRoundWithGemini(model, examStructure.round_2, roadmapData, 2),
        this.enhanceRoundWithGemini(model, examStructure.round_3, roadmapData, 3)
      ]);

      const enhancedExam: CreateExamDto = {
        ...examStructure,
        round_1: enhancedRounds[0],
        round_2: enhancedRounds[1],
        round_3: enhancedRounds[2]
      };
      
      this.logger.log('Successfully enhanced exam with Gemini AI');
      return enhancedExam;

    } catch (error) {
      this.logger.warn(`Gemini enhancement failed, using original structure: ${error.message}`);
      // Fallback to original structure if AI enhancement fails
      return examStructure;
    }
  }

  private async enhanceRoundWithGemini(
    model: any,
    roundQuestions: CreateQuestionDto[],
    roadmapData: RoadmapDataDto,
    roundNumber: number
  ): Promise<CreateQuestionDto[]> {
    try {
      // Process questions in smaller batches to avoid token limits
      const batchSize = 50;
      const enhancedQuestions: CreateQuestionDto[] = [];

      for (let i = 0; i < roundQuestions.length; i += batchSize) {
        const batch = roundQuestions.slice(i, i + batchSize);
        const prompt = this.createGeminiBatchPrompt(batch, roadmapData, roundNumber, i / batchSize + 1);
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const enhancedBatch = this.parseGeminiBatchResponse(response.text(), batch);
        
        enhancedQuestions.push(...enhancedBatch);
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return enhancedQuestions;
    } catch (error) {
      this.logger.warn(`Failed to enhance round ${roundNumber}: ${error.message}`);
      return roundQuestions;
    }
  }

  private createGeminiBatchPrompt(
    questions: CreateQuestionDto[],
    roadmapData: RoadmapDataDto,
    roundNumber: number,
    batchNumber: number
  ): string {
    const topicsContext = roadmapData.modules.map(module => ({
      module: module.module_title,
      topics: module.units.flatMap(unit =>
        unit.subunit.map(sub => sub.read.title)
      )
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

  private parseGeminiBatchResponse(geminiResponse: string, originalQuestions: CreateQuestionDto[]): CreateQuestionDto[] {
    try {
      // Clean the response to extract JSON
      const jsonMatch = geminiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in Gemini response');
      }

      const enhancedQuestions = JSON.parse(jsonMatch[0]);
      
      // Validate the enhanced questions
      if (!Array.isArray(enhancedQuestions) || enhancedQuestions.length !== originalQuestions.length) {
        throw new Error('Invalid enhanced questions format or count');
      }

      return enhancedQuestions.map((q, index) => ({
        question: q.question || originalQuestions[index].question,
        question_type: q.question_type || originalQuestions[index].question_type,
        exam_options: q.exam_options || originalQuestions[index].exam_options,
        correct_options: q.correct_options !== undefined ? q.correct_options : originalQuestions[index].correct_options
      }));

    } catch (error) {
      this.logger.warn(`Failed to parse Gemini batch response: ${error.message}`);
      return originalQuestions;
    }
  }

  private createGeminiPrompt(examStructure: CreateExamDto, roadmapData: RoadmapDataDto): string {
    const topicsContext = roadmapData.modules.map(module => ({
      module: module.module_title,
      topics: module.units.flatMap(unit =>
        unit.subunit.map(sub => sub.read.title)
      )
    }));

    return `
You are an expert educational content creator. I have an exam structure with ${this.TOTAL_QUESTIONS} questions about "${roadmapData.roadmap_title}".

ROADMAP CONTEXT:
${JSON.stringify(topicsContext, null, 2)}

CURRENT EXAM STRUCTURE:
- Title: ${examStructure.exam_title}
- Description: ${examStructure.exam_description}
- Level: ${examStructure.exam_levels}
- Total Questions: ${this.TOTAL_QUESTIONS} (${this.QUESTIONS_PER_ROUND} per round)

TASK: Enhance the exam questions to be more educational, accurate, and challenging while maintaining the exact structure.

REQUIREMENTS:
1. Keep the exact same number of questions (${this.QUESTIONS_PER_ROUND} per round)
2. Maintain question types: true_false, single_choice, multiple_choice
3. Ensure questions are directly related to the roadmap topics
4. Make questions more specific and educational
5. Improve answer options to be more realistic and challenging
6. Keep the same JSON structure format

Due to the large number of questions, please focus on improving the overall quality and educational value.

Return the complete enhanced exam structure as valid JSON with the following structure:
{
  "exam_title": "...",
  "exam_description": "...",
  "round_1": [...],
  "round_2": [...],
  "round_3": [...]
}
`;
  }

  private parseGeminiResponse(geminiResponse: string, originalStructure: CreateExamDto): CreateExamDto {
    try {
      // Clean the response to extract JSON
      const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Gemini response');
      }

      const enhancedData = JSON.parse(jsonMatch[0]);
      
      // Validate the enhanced structure has the required format
      if (!enhancedData.round_1 || !enhancedData.round_2 || !enhancedData.round_3) {
        throw new Error('Invalid enhanced structure format');
      }

      // Validate each round has exactly 300 questions
      if (enhancedData.round_1.length !== this.QUESTIONS_PER_ROUND || 
          enhancedData.round_2.length !== this.QUESTIONS_PER_ROUND || 
          enhancedData.round_3.length !== this.QUESTIONS_PER_ROUND) {
        throw new Error('Invalid question count in enhanced structure');
      }

      // Merge enhanced content with original structure
      const enhancedExam: CreateExamDto = {
        ...originalStructure,
        exam_title: enhancedData.exam_title || originalStructure.exam_title,
        exam_description: enhancedData.exam_description || originalStructure.exam_description,
        round_1: enhancedData.round_1.map(q => ({
          question: q.question,
          question_type: q.question_type,
          exam_options: q.exam_options,
          correct_options: q.correct_options
        })),
        round_2: enhancedData.round_2.map(q => ({
          question: q.question,
          question_type: q.question_type,
          exam_options: q.exam_options,
          correct_options: q.correct_options
        })),
        round_3: enhancedData.round_3.map(q => ({
          question: q.question,
          question_type: q.question_type,
          exam_options: q.exam_options,
          correct_options: q.correct_options
        }))
      };

      return enhancedExam;

    } catch (error) {
      this.logger.warn(`Failed to parse Gemini response: ${error.message}`);
      return originalStructure;
    }
  }
}