export enum Level {
  Elementary = "초등",
  Middle = "중등",
  High = "고등",
}

export interface Problem {
  id?: number;
  created_at?: string;
  problem: string;
  answer: string;
  solution: string;
  level?: Level;
  topic?: string;
  difficulty?: Difficulty;
  problem_plain?: string;
  answer_plain?: string;
  solution_plain?: string;
}

export enum Difficulty {
  Concept = "개념 확인",
  Basic = "기초",
  Fundamental = "기본",
  Medium = "보통",
  Advanced = "발전",
  Intense = "심화",
  Top = "최상위",
}