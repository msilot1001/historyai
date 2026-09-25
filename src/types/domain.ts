/** Shapes of the source history data (data.json / data.js) and everything derived from it. */

export interface Line {
  /** Original markup from the source note, including <b> emphasis. */
  html: string;
  /** Plain text of the same line. Grading and cloze positions are computed on this. */
  text: string;
}

export interface Position {
  page: number;
  column: number;
  top: number;
}

export interface Unit {
  id: string;
  entry_id: string;
  topic: number;
  topic_title: string;
  year: string;
  year_html: string;
  title: string;
  title_html: string;
  part: string;
  book: boolean;
  segment: number;
  lines: Line[];
  answer: string;
  position: Position;
}

/** A unit plus its position in the unmodified source order, used by the 순서 회상 mode. */
export interface IndexedUnit extends Unit {
  sourceIndex: number;
}

export interface Topic {
  number: number;
  title: string;
  entry_count: number;
}

export interface HistoryData {
  meta: { topics: number[]; [key: string]: unknown };
  topics: Topic[];
  entries: unknown[];
  units: Unit[];
}

/** question-bank.js rows: [topic, kind, space-separated refs, question, answer]. */
export type QuestionRow = [number, string, string, string, string];

export interface Question {
  id: string | number;
  topic?: number;
  kind?: string;
  refs: string[];
  q: string;
  a: string;
  facts?: string[];
  covers?: { id: string; line: number }[];
}

export interface DataBundle { version: number; data: HistoryData; questions: Question[] }

export type QuestionScope = 'current' | 'recap' | 'coach';

export interface PoolQuestion extends Question {
  scope: QuestionScope;
  source: string;
  groupCount: number;
}

/** One blank in the 원문. `start`/`end` index into the plain text of `line`. */
export interface ClozeTarget {
  id: string;
  /** Line index, or -1 for the year and -2 for the title. */
  line: number;
  start: number;
  end: number;
  answer: string;
}

export interface Candidate {
  start: number;
  end: number;
  answer: string;
  score: number;
}

export type StudyMode =
  | 'memorize' | 'recall' | 'blanks' | 'stages'
  | 'questions' | 'timeline' | 'order' | 'compare';

export type TimelineDirection = 'event' | 'year';

/** Persisted in localStorage under `history-v2`. Field names are a compatibility contract. */
export interface StudyState {
  topic: string;
  count: number;
  setIndex: number;
  indices: Partial<Record<StudyMode, number>>;
  session: string[];
  drafts: Record<string, string>;
  progress: Record<string, 'known' | 'review'>;
  stage: number;
  blankSeed: number;
  timelineDirection: TimelineDirection;
  placements: Record<string, string[]>;
  order: string[];
  selected: string | null;
  questionVersion: number;
  coachRound: Array<string | number>;
  coachIndex: number;
}

/** Ephemeral per-card view state; reset on every navigation. */
export interface Attempt {
  revealed: boolean;
  checked: boolean;
  hint: boolean;
}

export type PointStatus = 'covered' | 'partial' | 'missing' | 'incorrect';

export interface GradePoint {
  index: number;
  text: string;
  status: PointStatus;
  feedback: string;
}

export interface Grade {
  level: 'strong' | 'partial' | 'weak';
  reason: string;
  missing: string[];
  points: GradePoint[];
  model?: string;
  usage?: unknown;
}

export type Rating = 'known' | 'review';

export type CloudEvent =
  | { type: 'attempt'; id: string; at: string; dataVersion?: number; question: Question & { source?: string; scope?: string }; answer: string }
  | { type: 'grade'; attemptId: string; grade: Grade; dataVersion?: number; at?: string }
  | { type: 'rating'; attemptId: string; rating: Rating; at?: string }
  | { type: 'reviewed'; questionId: string; pointIndex: number; dataVersion?: number; at: string };

export interface PointHistoryItem {
  at: string;
  status: PointStatus;
  answer: string;
  feedback: string;
}

/** One key fact of one question, with the full history of how it has been graded. */
export interface TrackedPoint {
  key: string;
  id: string | number;
  index: number;
  text: string;
  status: PointStatus;
  feedback: string;
  question: Question & { source?: string };
  at: string;
  answer: string;
  history: PointHistoryItem[];
  misses: number;
  reviewed: boolean;
}

export interface TopicSummary {
  number: number;
  title: string;
  total: number;
  tested: number;
  assessed: number;
  covered: number;
  gaps: number;
  legacy: number;
}

export interface LearningSnapshot {
  dataVersion: number;
  all: Array<{ grade?: Grade; rating?: Rating } & Extract<CloudEvent, { type: 'attempt' }>>;
  points: TrackedPoint[];
  gaps: TrackedPoint[];
  covered: TrackedPoint[];
  topics: TopicSummary[];
  questions: Map<string | number, Question & { source?: string }>;
  legacy: Array<Extract<CloudEvent, { type: 'attempt' }>>;
  tested: number;
  unseen: number;
  reviewed: Map<string, string>;
}
