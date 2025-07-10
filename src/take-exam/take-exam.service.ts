import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExamLevel } from 'src/common/enum/exam-level.enum';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
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

interface ExamResponse {
  exam_title: string;
  exam_description: string;
  passing_score: number;
  exam_time: number;
  exam_levels: ExamLevel;
  tags: string[];
  exam_questions: CreateQuestionDto[];
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
      console.log('Full exam data:', JSON.stringify(exam, null, 2));
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
            // exam_questions: { $push: '$exam_questions' },
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

  async generateExamByRoadmapTitle(
    roadmapData: RoadmapData,
    roadmapId: string,
    examId: string,
  ): Promise<Exam> {
    // Validate input data

    if (!roadmapData) {
      this.logger.error('roadmapData is null or undefined');
      throw new HttpException(
        'roadmapData is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !roadmapData.roadmap_title ||
      typeof roadmapData.roadmap_title !== 'string' ||
      roadmapData.roadmap_title.trim() === ''
    ) {
      this.logger.error('Invalid roadmap_title: must be a non-empty string');
      throw new HttpException(
        'Invalid roadmap_title: must be a non-empty string',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !Array.isArray(roadmapData.modules) ||
      roadmapData.modules.length === 0
    ) {
      this.logger.error('Invalid modules: must be a non-empty array');
      throw new HttpException(
        'Invalid modules: must be a non-empty array',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Extract relevant data
    const roadmapTitle = roadmapData.roadmap_title.trim();
    const moduleTitles = roadmapData.modules.map(
      (module) => module.module_title,
    );
    const readTitles = roadmapData.modules.flatMap((module) =>
      module.units
        .filter((unit) => unit.unit_type === 'read')
        .flatMap((unit) =>
          unit.subunit
            .map((sub) => sub.read?.title)
            .filter((title): title is string => !!title),
        ),
    );

    const prompt = `
You are to generate a **valid JSON** object representing a JavaScript exam using the following learning roadmap data:

- Roadmap Title: ${roadmapTitle}
- Module Titles: ${moduleTitles.join(', ')}
- Reading Topics: ${readTitles.join(', ')}

---

### 📘 Exam Instructions

Create an exam that:

- Has **exactly 50 questions** total.
- Follows this question type distribution:
  - **20 true_false** questions
  - **20 single_choice** questions
  - **10 multiple_choice** questions
- Every question must contain **exactly 4 exam_options**.
- Multiple choice (multiple_choice) questions must contain **exactly 2 correct options**.
- Each question must have a correct_options for:
  - true_false: number (0 or 1)
  - single_choice: number (0–3)
  - multiple_choice: array of exactly 2 numbers (e.g., [0, 3])

---

### 🧠 Content Focus

Ensure all questions are:
- Based on the roadmap and topics provided.
- Cover beginner JavaScript concepts like:
  - Syntax and operators
  - Variables and data types
  - Functions and scope
  - Loops and conditionals
  - Arrays and objects
  - Events and event listeners
  - DOM manipulation

---

### ⚠️ JSON Format Guidelines

Wrap your output **strictly** like this:

\`\`\`json
{
  "exam_title": "Basics of JavaScript Exam",
  "exam_description": "A comprehensive exam to test knowledge of fundamental JavaScript concepts for web development",
  "passing_score": 75,
  "exam_time": 120,
  "exam_levels": "medium",
  "tags": ["JavaScript", "Web Development", "Frontend", "Programming"],
  "exam_questions": [
    {
      "question": "JavaScript is a statically typed language.",
      "exam_options": ["True", "False", "Maybe", "Depends"],
      "question_type": "true_false",
      "correct_options": 1
    },
    {
      "question": "Which keyword is used to declare a variable in JavaScript?",
      "exam_options": ["var", "let", "const", "int"],
      "question_type": "single_choice",
      "correct_options": 0
    },
    {
      "question": "Which of the following are JavaScript data types?",
      "exam_options": ["Number", "String", "Character", "Boolean"],
      "question_type": "multiple_choice",
      "correct_options": [0, 1]
    }
    // ...total 50 questions
  ]
}
\`\`\`

---

### 🔒 Strict Output Requirements

- **All output must be valid JSON** wrapped in triple backticks with a json tag.
- Output must include **exactly 50 questions** — no more, no less.
- Every question must include **exactly 4 distinct options**.
- true_false questions must have:
  "exam_options": ["True", "False", "Maybe", "Depends"]
  "correct_options": 0 or 1
— **no other values allowed** (e.g., not "Sometimes", etc.).
- multiple_choice questions must include **exactly 2 correct options** in correct_options.
- Escape all special characters correctly (e.g., quotes, newlines) to ensure valid JSON.
- **Do not include roadmap_ID, exam_ID, or any other fields not specified**.
- **Do not include any explanations, markdown, or notes outside the triple backtick block**.
- **Do not repeat or duplicate questions**.

Begin now. Return **only the JSON object**, formatted as valid JSON in a triple backtick \`\`\`json block.
`;

    // Retry logic for AI service
    const maxRetries = 5;
    let attempt = 0;
    let examResponse: ExamResponse | null = null;

    while (attempt < maxRetries) {
      try {
        this.logger.log(`Attempt ${attempt + 1}: Initializing Gemini AI model`);
        const model: GenerativeModel = this.genAI.getGenerativeModel({
          model: 'gemini-1.5-pro',
        });

        this.logger.log(`Attempt ${attempt + 1}: Sending prompt to Gemini AI`);
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 15000, // Increased to handle 50 questions
            temperature: 0.7,
          },
        });

        const responseText = result.response.text();
        this.logger.log(
          `Attempt ${attempt + 1}: Received response from Gemini AI`,
        );
        this.logger.debug(`Raw AI response: ${responseText}`);

        // Extract JSON from response
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch?.[1]) {
          this.logger.error(
            'Invalid JSON format in AI response: JSON not wrapped in triple backticks',
          );
          throw new Error(
            'Invalid JSON format in AI response: JSON not wrapped in triple backticks',
          );
        }

        const jsonString = jsonMatch[1].trim();
        try {
          examResponse = JSON.parse(jsonString);
        } catch (parseError) {
          this.logger.error(
            `Failed to parse AI response as JSON: ${parseError.message}`,
          );
          this.logger.debug(`Faulty JSON string: ${jsonString}`);
          throw new Error(`Failed to parse AI response: ${parseError.message}`);
        }

        break; // Success, exit retry loop
      } catch (error) {
        attempt++;
        const isRateLimitError =
          error.message.includes('429') ||
          error.message.includes('Too Many Requests');
        if (isRateLimitError) {
          this.logger.warn(
            `Rate limit exceeded on attempt ${attempt}: ${error.message}`,
          );
          if (attempt === maxRetries) {
            this.logger.error(
              `Failed to generate exam after ${maxRetries} attempts due to rate limit: ${error.message}`,
              error.stack,
            );
            throw new HttpException(
              'Rate limit exceeded for AI service. Please try again later or contact support.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }
          await new Promise((resolve) =>
            setTimeout(resolve, 60000 * Math.pow(2, attempt)),
          );
        } else {
          this.logger.warn(
            `Attempt ${attempt} failed: ${error.message}`,
            error.stack,
          );
          if (attempt === maxRetries) {
            this.logger.error(
              `Failed to generate exam after ${maxRetries} attempts: ${error.message}`,
              error.stack,
            );
            throw new HttpException(
              `Failed to generate exam from AI service: ${error.message}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt)),
          );
        }
      }
    }

    if (!examResponse) {
      this.logger.error('No valid response from AI service after retries');
      throw new HttpException(
        'No valid response from AI service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    examResponse.exam_questions = this.enforceExactDistribution(
      examResponse.exam_questions,
    );

    // Validate response structure
    const validationErrors: string[] = [];
    if (!examResponse.exam_title)
      validationErrors.push('exam_title is missing');
    if (!examResponse.exam_description)
      validationErrors.push('exam_description is missing');
    if (!examResponse.exam_questions)
      validationErrors.push('exam_questions is missing');
    if (examResponse.exam_questions.length > 50) {
      this.logger.warn(`More than 50 questions received: trimming to 50`);
      examResponse.exam_questions = examResponse.exam_questions.slice(0, 50);
    }

    if (!examResponse.passing_score)
      validationErrors.push('passing_score is missing');
    if (!examResponse.exam_time) validationErrors.push('exam_time is missing');
    if (
      !examResponse.exam_levels ||
      !['basic', 'medium', 'hard'].includes(examResponse.exam_levels)
    ) {
      validationErrors.push(
        `exam_levels is invalid: ${examResponse.exam_levels}`,
      );
    }
    if (!Array.isArray(examResponse.tags))
      validationErrors.push('tags is not an array');

    // Check for unexpected fields
    const expectedFields = [
      'exam_title',
      'exam_description',
      'passing_score',
      'exam_time',
      'exam_levels',
      'tags',
      'exam_questions',
    ];
    const unexpectedFields = Object.keys(examResponse).filter(
      (key) => !expectedFields.includes(key),
    );
    if (unexpectedFields.length > 0) {
      this.logger.warn(
        `Unexpected fields in AI response: ${unexpectedFields.join(', ')}`,
      );
      unexpectedFields.forEach((key) => delete examResponse[key]);
    }

    if (validationErrors.length > 0) {
      this.logger.error(
        `Invalid exam structure: ${validationErrors.join('; ')}`,
      );
      throw new HttpException(
        `Invalid exam structure from AI service: ${validationErrors.join('; ')}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Validate question types, options, and correct_options
    const questionCounts = {
      true_false: 0,
      single_choice: 0,
      multiple_choice: 0,
    };

    for (const question of examResponse.exam_questions) {
      if (
        !question.question_type ||
        !['true_false', 'single_choice', 'multiple_choice'].includes(
          question.question_type,
        )
      ) {
        this.logger.error(`Invalid question_type: ${question.question_type}`);
        throw new HttpException(
          `Invalid question type in AI response: ${question.question_type}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Validate number of options
      if (
        !Array.isArray(question.exam_options) ||
        question.exam_options.length !== 4
      ) {
        this.logger.error(
          `Invalid exam_options for question: ${question.question}, expected 4 options, got ${question.exam_options?.length || 0}`,
        );
        throw new HttpException(
          `Invalid exam_options: question must have exactly 4 options`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Validate correct_options
      if (question.question_type === 'true_false') {
        if (
          typeof question.correct_options !== 'number' ||
          ![0, 1].includes(question.correct_options)
        ) {
          this.logger.error(
            `Invalid correct_options for true_false question: ${question.question}`,
          );
          throw new HttpException(
            `Invalid correct_options for true_false question: must be 0 or 1`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      } else if (question.question_type === 'single_choice') {
        if (
          typeof question.correct_options !== 'number' ||
          ![0, 1, 2, 3].includes(question.correct_options)
        ) {
          this.logger.error(
            `Invalid correct_options for single_choice question: ${question.question}`,
          );
          throw new HttpException(
            `Invalid correct_options for single_choice question: must be 0, 1, 2, or 3`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      } else if (question.question_type === 'multiple_choice') {
        if (
          !Array.isArray(question.correct_options) ||
          question.correct_options.length !== 2
        ) {
          this.logger.error(
            `Invalid correct_options for multiple_choice question: ${question.question}`,
          );
          throw new HttpException(
            `Invalid correct_options for multiple_choice question: must be an array of exactly 2 numbers`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
        if (
          !question.correct_options.every(
            (opt) => typeof opt === 'number' && [0, 1, 2, 3].includes(opt),
          )
        ) {
          this.logger.error(
            `Invalid correct_options values for multiple_choice question: ${question.question}`,
          );
          throw new HttpException(
            `Invalid correct_options values for multiple_choice question: must be numbers 0, 1, 2, or 3`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
      questionCounts[question.question_type]++;
    }

    if (
      questionCounts.true_false !== 20 ||
      questionCounts.single_choice !== 20 ||
      questionCounts.multiple_choice !== 10
    ) {
      this.logger.error(
        `Incorrect question type distribution: ${JSON.stringify(questionCounts)}`,
      );
      throw new HttpException(
        `Incorrect question type distribution: expected 20 true_false, 20 single_choice, 10 multiple_choice, got ${JSON.stringify(questionCounts)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Prepare CreateExamDto
    const createExamDto: CreateExamDto = {
      roadmap_ID: roadmapId,
      exam_ID: examId,
      exam_title: examResponse.exam_title,
      exam_description: examResponse.exam_description,
      passing_score: examResponse.passing_score,
      exam_time: examResponse.exam_time,
      exam_levels: examResponse.exam_levels,
      tags: examResponse.tags,
      round_1: examResponse.exam_questions.slice(0, 20),
      round_2: examResponse.exam_questions.slice(20, 30),
      round_3: examResponse.exam_questions.slice(30, 40),
    };

    // Save the exam
    try {
      const savedExam = await this.createExam(createExamDto);
      this.logger.log(`Exam successfully generated and saved: ${examId}`);
      return savedExam;
    } catch (error) {
      this.logger.error(`Failed to save exam: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to save generated exam',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private enforceExactDistribution(
    questions: CreateQuestionDto[],
  ): CreateQuestionDto[] {
    const validTrueFalse = questions.filter(
      (q) =>
        q.question_type === 'true_false' &&
        typeof q.correct_options === 'number' &&
        (q.correct_options === 0 || q.correct_options === 1),
    );

    const validSingleChoice = questions.filter(
      (q) =>
        q.question_type === 'single_choice' &&
        typeof q.correct_options === 'number' &&
        q.correct_options >= 0 &&
        q.correct_options <= 3,
    );

    const validMultipleChoice = questions.filter(
      (q) =>
        q.question_type === 'multiple_choice' &&
        Array.isArray(q.correct_options) &&
        q.correct_options.length === 2 &&
        q.correct_options.every(
          (opt) => typeof opt === 'number' && opt >= 0 && opt <= 3,
        ),
    );

    const trueFalse = validTrueFalse.slice(0, 20);
    const singleChoice = validSingleChoice.slice(0, 20);
    const multipleChoice = validMultipleChoice.slice(0, 10);
    return [...trueFalse, ...singleChoice, ...multipleChoice];
  }

}