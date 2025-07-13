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
import { CreateExamDto } from './dto/create-exam.dto';
import { Exam } from './schema/exam.schema';

// Define interfaces for type safety
interface RoadmapData {
  roadmap_title: string;
  modules: Array<{
    module_title: string;
    units: Array<{
      unit_type: string;
      subunit: Array<{
        read?: { title: string };
      }>;
    }>;
  }>;
}

@Injectable()
export class TakeExamService {
  private readonly logger = new Logger(TakeExamService.name);
  private readonly genAI: GoogleGenerativeAI;

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

      // Defensive check before mapping
      const round1 = Array.isArray(createExamDto.round_1)
        ? createExamDto.round_1
        : [];
      const round2 = Array.isArray(createExamDto.round_2)
        ? createExamDto.round_2
        : [];
      const round3 = Array.isArray(createExamDto.round_3)
        ? createExamDto.round_3
        : [];

      const exam = new this.examModel({
        ...createExamDto,
        round_1: round1.map((question) => ({
          question: question.question,
          exam_options: question.exam_options,
          question_type: question.question_type,
          correct_options: question.correct_options,
        })),
        round_2: round2.map((question) => ({
          question: question.question,
          exam_options: question.exam_options,
          question_type: question.question_type,
          correct_options: question.correct_options,
        })),
        round_3: round3.map((question) => ({
          question: question.question,
          exam_options: question.exam_options,
          question_type: question.question_type,
          correct_options: question.correct_options,
        })),
      });

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

  async generateRawQuestions(roadmapData: RoadmapData): Promise<any[]> {
    this.logger.log('Generating raw questions...');
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const { roadmap_title, modules } = roadmapData;
    const moduleTitles = modules.map((m) => m.module_title);
    const unitTitles = modules.flatMap((m) =>
      m.units.flatMap((u) =>
        u.subunit
          .map((s) => s.read?.title)
          .filter((title): title is string => !!title),
      ),
    );

    const TARGET_QUESTIONS = 100;
    const MAX_ATTEMPTS = 5;
    const collectedQuestions: Record<string, any> = {};
    let attempt = 1;

    const prompt = `
Generate exactly 100 unique questions based on the roadmap titled "${roadmap_title}" with modules: ${moduleTitles.join(', ')}, and units: ${unitTitles.join(', ')}.

Return a JSON array of 100 questions with the following strict structure for each question:
{
  "question": string, // The question text, 10-100 characters, clear and concise
  "question_type": "single_choice" | "multiple_choice" | "true_false", // Exactly one of these types
  "exam_options": string[], // Array of 4 strings for single_choice/multiple_choice, ["True", "False"] for true_false
  "correct_options": number | number[] // Single number (0-3) for single_choice/true_false, array of exactly 2 numbers (0-3) for multiple_choice
}

e.g.:
  {
    "question": "What is the capital of France?",
    "question_type": "single_choice",
    "exam_options": ["Paris", "London", "Berlin", "Rome"],
    "correct_options": 0
  },
  {
    "question": "Is the Earth round?",
    "question_type": "true_false",
    "exam_options": ["True", "False"],
    "correct_options": 0
  },
  {
    "question": "What is the capital of France?",
    "question_type": "multiple_choice",
    "exam_options": ["Paris", "London", "Berlin", "Rome"],
    "correct_options": [0, 1]
  }

Requirements:
- Exactly 100 questions: 35 single_choice, 35 multiple_choice, 30 true_false
- No duplicate questions
- Questions must be relevant to the roadmap topics
- For multiple_choice, correct_options must contain exactly 2 valid indices
- For true_false, exam_options must be exactly ["True", "False"]
- Return only the JSON array, no additional text
`;

    while (
      Object.keys(collectedQuestions).length < TARGET_QUESTIONS &&
      attempt <= MAX_ATTEMPTS
    ) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8000,
            temperature: 0.7,
          },
        });

        const rawText = result.response.text();
        let parsed: any[];

        try {
          parsed = JSON.parse(rawText);
        } catch {
          this.logger.warn(`Attempt ${attempt}: Failed to parse response.`);
          attempt++;
          await this.sleep(1000 * attempt);
          continue;
        }

        for (const q of parsed) {
          if (
            q?.question &&
            !collectedQuestions[q.question] &&
            q.question_type &&
            ['single_choice', 'multiple_choice', 'true_false'].includes(
              q.question_type,
            ) &&
            q.exam_options &&
            q.correct_options !== undefined &&
            this.isValidQuestion(q)
          ) {
            collectedQuestions[q.question] = q;
          }
        }

        this.logger.log(
          `Collected ${Object.keys(collectedQuestions).length} questions so far.`,
        );
      } catch (err) {
        this.logger.warn(`Attempt ${attempt} failed: ${err.message}`);
      }

      attempt++;
      await this.sleep(1000 * attempt);
    }

    const finalQuestions = Object.values(collectedQuestions);
    if (finalQuestions.length < TARGET_QUESTIONS) {
      throw new InternalServerErrorException(
        `Only ${finalQuestions.length} unique questions generated after ${MAX_ATTEMPTS} attempts.`,
      );
    }

    return finalQuestions.slice(0, TARGET_QUESTIONS);
  }

  private isValidQuestion(question: any): boolean {
    const { question_type, exam_options, correct_options } = question;

    if (
      typeof question !== 'string' ||
      question.length < 10 ||
      question.length > 100
    ) {
      return false;
    }

    if (question_type === 'true_false') {
      return (
        Array.isArray(exam_options) &&
        exam_options.length === 2 &&
        exam_options[0] === 'True' &&
        exam_options[1] === 'False' &&
        Number.isInteger(correct_options) &&
        correct_options >= 0 &&
        correct_options <= 1
      );
    }

    if (question_type === 'single_choice') {
      return (
        Array.isArray(exam_options) &&
        exam_options.length === 4 &&
        exam_options.every((opt: any) => typeof opt === 'string') &&
        Number.isInteger(correct_options) &&
        correct_options >= 0 &&
        correct_options <= 3
      );
    }

    if (question_type === 'multiple_choice') {
      return (
        Array.isArray(exam_options) &&
        exam_options.length === 4 &&
        exam_options.every((opt: any) => typeof opt === 'string') &&
        Array.isArray(correct_options) &&
        correct_options.length === 2 &&
        correct_options.every(
          (i: any) => Number.isInteger(i) && i >= 0 && i <= 3,
        )
      );
    }

    return false;
  }

  async refineQuestionsToExamStructure(
    rawQuestions: any[],
    roadmapData: RoadmapData,
    roadmapId: string,
    examId: string,
  ): Promise<CreateExamDto> {
    this.logger.log('Refining questions to exam structure...');
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const { roadmap_title, modules } = roadmapData;
    const moduleTitles = modules.map((m) => m.module_title);
    const unitTitles = modules.flatMap((m) =>
      m.units.flatMap((u) =>
        u.subunit
          .map((s) => s.read?.title)
          .filter((title): title is string => !!title),
      ),
    );

    rawQuestions.forEach((question) => this.sanitizeQuestionOptions(question));

    const prompt = `
You are given 100 validated exam questions. Structure them into a JSON object for an exam with 3 rounds.

Strict output format:
{
  "roadmap_ID": "${roadmapId}",
  "exam_ID": "${examId}",
  "exam_title": "${roadmap_title} Comprehensive Exam",
  "exam_description": "A comprehensive exam covering all modules and units of ${roadmap_title}",
  "passing_score": 80,
  "exam_time": 120,
  "exam_levels": "${ExamLevel.MEDIUM}",
  "tags": ["${roadmap_title}", "${moduleTitles[0] || 'General'}", "${unitTitles[0] || 'General'}"],
  "round_1": [],
  "round_2": [],
  "round_3": []
}

Requirements:
- Distribute 100 questions equally across rounds (33-34 questions each)
- Each round must have balanced question types as specified
- Maintain exact question structure from input
- Use all 100 questions, no additions or modifications
- Return only the JSON object, no additional text

Input questions:
${JSON.stringify(rawQuestions)}
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 10000,
        temperature: 0.4,
      },
    });

    const refined = result.response.text();

    try {
      const parsed = JSON.parse(refined);
      return parsed as CreateExamDto;
    } catch (err) {
      this.logger.error(`Failed to parse structured exam JSON: ${err.message}`);
      throw new InternalServerErrorException(
        'Failed to format AI-generated questions into exam structure',
      );
    }
  }

  private sanitizeQuestionOptions(question: any): void {
    const { question_type, correct_options, exam_options } = question;

    if (question_type === 'multiple_choice') {
      if (!Array.isArray(correct_options) || correct_options.length !== 2) {
        question.correct_options = [0, 1];
      } else {
        question.correct_options = correct_options
          .filter(
            (i) => Number.isInteger(i) && i >= 0 && i < exam_options.length,
          )
          .slice(0, 2);
        if (question.correct_options.length < 2) {
          question.correct_options = [0, 1];
        }
      }
    }

    if (question_type === 'single_choice' || question_type === 'true_false') {
      if (
        typeof correct_options !== 'number' ||
        !Number.isInteger(correct_options) ||
        correct_options < 0 ||
        correct_options >= exam_options.length
      ) {
        question.correct_options = 0;
      }
    }

    if (
      question_type === 'true_false' &&
      (!Array.isArray(exam_options) ||
        exam_options.length !== 2 ||
        exam_options[0] !== 'True' ||
        exam_options[1] !== 'False')
    ) {
      question.exam_options = ['True', 'False'];
      question.correct_options = 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
