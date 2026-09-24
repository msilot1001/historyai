import type { HistoryData, QuestionRow } from './domain';

declare global {
  interface Window {
    HISTORY_DATA: HistoryData;
    HISTORY_QUESTIONS: QuestionRow[];
  }
}

// data.js and question-bank.js are source-data files kept verbatim; they only assign to window.
declare module '*/data.js';
declare module '*/question-bank.js';

export {};
