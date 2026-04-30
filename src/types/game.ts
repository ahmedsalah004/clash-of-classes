export type LifelineKey = 'mcq' | 'hint' | 'twoAnswers';

export interface Lifeline {
  mcq: boolean;
  hint: boolean;
  twoAnswers: boolean;
}

export interface Question {
  id: string;
  categoryId: string;
  points: 100 | 200 | 300 | 400;
  prompt: string;
  answer: string;
  hint: string;
  mcqOptions: string[];
  twoAnswersOptions: [string, string];
}

export interface Category {
  id: string;
  title: string;
  questions: Question[];
}

export interface Pack {
  id: string;
  title: string;
  stageLabel: string;
  subjectLabel: string;
  categories: Category[];
}

export interface Team {
  id: string;
  name: string;
  points: number;
  lifelinesUsed: Lifeline;
}

export interface GameState {
  pack: Pack;
  teams: Team[];
  currentTeamTurnIndex: number;
  usedQuestionIds: string[];
  currentQuestionId: string | null;
  phase: 'board' | 'question';
  stealPhase: boolean;
}
