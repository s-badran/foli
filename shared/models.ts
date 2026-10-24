import { z } from 'zod';
import type { Card } from 'ts-fsrs';

export const providerSchema = z.object({
  provider: z.enum(['offline', 'openai', 'copilot']).default('offline'),
  model: z.string().max(120).default('gpt-4o-mini'),
  baseUrl: z.url().default('https://api.openai.com/v1'),
  supplement: z.boolean().default(false),
});
export type ProviderConfig = z.infer<typeof providerSchema>;

export const contentSchema = z.object({
  summary: z.string().min(40).max(16000),
  keyPoints: z.array(z.string().min(3).max(1200)).min(2).max(12),
  supplement: z.string().max(8000).default(''),
  cards: z
    .array(
      z.object({
        question: z.string().min(5).max(2000),
        answer: z.string().min(3).max(4000),
        objectiveIds: z.array(z.string()).optional(),
      }),
    )
    .min(2)
    .max(16),
  quiz: z
    .array(
      z.object({
        question: z.string().min(5).max(2000),
        options: z.array(z.string().min(1).max(2000)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(5).max(4000),
        objectiveIds: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(12),
});

export type ScheduleCard = Omit<Card, 'due' | 'last_review'> & {
  due: string;
  last_review?: string;
};
export type StudyCard = z.infer<typeof contentSchema>['cards'][number] & {
  id: string;
  schedule: ScheduleCard;
};
export interface GeneratedContent {
  summary: string;
  keyPoints: string[];
  supplement: string;
  cards: StudyCard[];
  quiz: z.infer<typeof contentSchema>['quiz'];
  provider: ProviderConfig['provider'];
  model: string;
  generatedAt: string;
  authorship?: 'tutor-authored' | 'extractive' | 'model';
  evidence?: { sourceId: string; pageStart?: number; pageEnd?: number; note: string }[];
}
export const learnerSchema = z.object({
  familiarity: z.enum(['new', 'basic', 'refresh']).default('new'),
  role: z.enum(['student', 'professional', 'career-change', 'other']).default('professional'),
  goal: z.string().trim().max(500).default('Prepare for the exam with scenario-based practice.'),
});
export type Learner = z.infer<typeof learnerSchema>;
export interface LearningObjective {
  id: string;
  title: string;
  sourceId: string;
  pageStart?: number;
  pageEnd?: number;
  assessment: 'recall' | 'application' | 'both';
}
export interface Chapter {
  id: string;
  folderId: string;
  title: string;
  order: number;
  sourceId: string;
  pageStart?: number;
  pageEnd?: number;
  description: string;
  objectives?: LearningObjective[];
  coverageStatus?: 'source-audited' | 'draft';
}
export interface Section {
  id: string;
  folderId: string;
  sourceId: string;
  title: string;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  read: boolean;
  content?: GeneratedContent;
  chapterId?: string;
  archived?: boolean;
  objective?: string;
  sourceFragment?: boolean;
  chapterTitle?: string;
}
export interface Source {
  id: string;
  folderId: string;
  name: string;
  kind: 'pdf' | 'md' | 'txt' | 'topic';
  pages?: number;
  addedAt: string;
  file?: string;
  contentHash?: string;
  relevance?: {
    score: number;
    threshold: number;
    status: 'accepted' | 'needs-review' | 'excluded';
    method: string;
    sharedTerms: string[];
    reason: string;
  };
}
export interface StudyPlan {
  examDate: string;
  dailyMinutes: number;
  createdAt: string;
  days: { date: string; sectionIds: string[]; reviewMinutes: number; studyMinutes: number }[];
  warning?: string;
  chapterIds?: string[];
  familiarity?: Learner['familiarity'];
}
export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  plan?: StudyPlan;
  directory?: string;
  mainSourceId?: string;
  learner?: Learner;
  prompt?: string;
  curriculumRevision?: number;
  curriculumNote?: string;
  materialsVersion?: number;
}
export interface QuizAttempt {
  id: string;
  sectionId: string;
  date: string;
  answers: number[];
  correct: number;
  total: number;
}
export interface Review {
  cardId: string;
  sectionId: string;
  date: string;
  rating: number;
}
export interface StudyState {
  version: 1;
  folders: Folder[];
  sources: Source[];
  sections: Section[];
  attempts: QuizAttempt[];
  reviews: Review[];
  chapters: Chapter[];
}
export function emptyState(): StudyState {
  return {
    version: 1,
    folders: [],
    sources: [],
    sections: [],
    attempts: [],
    reviews: [],
    chapters: [],
  };
}
