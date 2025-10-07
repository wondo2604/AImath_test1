
export interface Problem {
  problem: string;
  answer: string;
  solution: string;
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