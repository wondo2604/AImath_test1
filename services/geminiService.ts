import { GoogleGenAI, Type } from "@google/genai";
import type { Problem, Level } from '../types';
import { Difficulty } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const problemSchema = {
  type: Type.OBJECT,
  properties: {
    problem: {
      type: Type.STRING,
      description: "LaTeX 형식의 수학 문제입니다. 블록 방정식에는 $$를, 인라인에는 $를 사용합니다.",
    },
    answer: {
      type: Type.STRING,
      description: "설명이나 단위가 없는 최종 숫자 또는 간단한 대수적 답입니다.",
    },
    solution: {
      type: Type.STRING,
      description: "문제를 해결하는 방법에 대한 단계별 설명이며, LaTeX 형식입니다.",
    }
  },
  required: ["problem", "answer", "solution"]
};

const generateProblemPrompt = (level: Level, topic: string, difficulty: Difficulty): string => {
  let prompt = `"${level}" 과정의 "${topic}"에 대한 "${difficulty}" 난이도의 수학 문제를 생성해 주세요.`;
  if (difficulty === Difficulty.Concept) {
    prompt += ` 이것은 학생의 핵심 개념 이해도를 확인하기 위한 기본적인 질문이어야 합니다.`
  }
  prompt += " 문제와 풀이는 모든 수학적 표기에 LaTeX를 사용해야 합니다. 제공된 스키마를 엄격히 준수하는 JSON 객체로 출력 형식을 지정해 주세요."
  return prompt;
};


const callGeminiApi = async (prompt: string): Promise<Problem> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: problemSchema,
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    const data = JSON.parse(jsonText);

    // Basic validation
    if (data.problem && data.answer && data.solution) {
        return data as Problem;
    } else {
        throw new Error("API로부터 유효하지 않은 문제 형식을 받았습니다.");
    }

  } catch (error) {
    console.error("Gemini API 호출 오류:", error);
    throw new Error("수학 문제를 생성하는 데 실패했습니다. 자세한 내용은 콘솔을 확인하세요.");
  }
};


export const generateMathProblem = async (level: Level, topic: string, difficulty: Difficulty): Promise<Problem> => {
    const prompt = generateProblemPrompt(level, topic, difficulty);
    return callGeminiApi(prompt);
};