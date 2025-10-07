import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Problem, Difficulty, Level } from '../types';

let supabase: SupabaseClient | null = null;

export const initSupabase = (url: string, key: string): boolean => {
  if (url && key) {
    try {
      supabase = createClient(url, key);
      console.log("Supabase client initialized successfully.");
      return true;
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error);
      supabase = null;
      return false;
    }
  }
  console.error("Supabase URL or Anon Key is missing for initialization.");
  return false;
};

export const getProblemsFromDb = async (): Promise<Problem[]> => {
  if (!supabase) {
    throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");
  }
  const { data, error } = await supabase
    .from('math_problems')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching from Supabase:', error);
    throw new Error('데이터베이스에서 문제를 불러오는 데 실패했습니다.');
  }

  return data as Problem[];
};

/**
 * LaTeX 문자열을 사람이 읽을 수 있는 일반 텍스트로 변환합니다.
 * @param latex 변환할 LaTeX 문자열.
 * @returns 일반 텍스트 문자열.
 */
const convertLatexToPlainText = (latex: string): string => {
  if (!latex) return '';

  return latex
    // LaTeX 구분 기호 제거 ($, $$, \[, \])
    .replace(/\$\$|\\\[|\\\]|\$/g, '')
    // \times를 'x'로 변환
    .replace(/\\times/g, 'x')
    // \div를 '÷'로 변환
    .replace(/\\div/g, '÷')
    // \cdot을 '·'로 변환
    .replace(/\\cdot/g, '·')
    // \frac{a}{b}를 'a/b'로 변환
    .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$1/$2')
    // 그룹화를 위한 중괄호 제거
    .replace(/[{}]/g, '')
    // 앞뒤 공백 제거
    .trim();
};


export const saveProblemToDb = async (problemData: Problem, level: Level, topic: string, difficulty: Difficulty): Promise<void> => {
  if (!supabase) {
    throw new Error("Supabase 클라이언트가 초기화되지 않았습니다. 먼저 데이터베이스에 연결하세요.");
  }

  const { problem, answer, solution } = problemData;
  
  // 데이터베이스 가독성을 위해 LaTeX를 일반 텍스트로 변환합니다.
  const problem_plain = convertLatexToPlainText(problem);
  const answer_plain = convertLatexToPlainText(answer);
  const solution_plain = convertLatexToPlainText(solution);

  // 중요: 이 기능이 작동하려면 Supabase 'math_problems' 테이블에
  // 'problem_plain', 'answer_plain', 'solution_plain' (모두 text 타입) 컬럼을 추가해야 합니다.
  const { error } = await supabase
    .from('math_problems')
    .insert([
      { 
        level, 
        topic, 
        difficulty, 
        problem,          // 앱 내 렌더링을 위한 원본 LaTeX
        answer,           // 앱 내 렌더링을 위한 원본 LaTeX
        solution,         // 앱 내 렌더링을 위한 원본 LaTeX
        problem_plain,    // DB 가독성을 위한 일반 텍스트
        answer_plain,     // DB 가독성을 위한 일반 텍스트
        solution_plain    // DB 가독성을 위한 일반 텍스트
      },
    ]);

  if (error) {
    console.error('Error saving to Supabase:', error);
    // FIX: [object Object]를 표시하지 않도록 특정 `error.message` 속성 사용.
    // 이것은 훨씬 더 명확하고 사용자 친화적인 오류를 제공합니다.
    throw new Error(`데이터베이스에 문제를 저장하는 데 실패했습니다: ${error.message}`);
  }

  console.log('Problem saved successfully.');
};