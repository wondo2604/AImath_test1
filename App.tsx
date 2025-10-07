import React, { useState, useEffect, useCallback } from 'react';
import { TOPICS, DIFFICULTIES } from './constants';
import { generateMathProblem } from './services/geminiService';
import type { Problem } from './types';
import { Difficulty } from './types';
import Spinner from './components/Spinner';
import { LightBulbIcon, CopyIcon } from './components/icons';

// MathJax global object declaration
declare global {
    interface Window {
      MathJax: {
        typeset: () => void;
      };
    }
}

type CopiedTextType = 'problem' | 'answer' | 'solution' | null;

export default function App() {
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Concept);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedTextType, setCopiedTextType] = useState<CopiedTextType>(null);

  useEffect(() => {
    if (problem) {
      // Delay typesetting to ensure DOM is updated
      setTimeout(() => {
        if (window.MathJax) {
          window.MathJax.typeset();
        }
      }, 100);
    }
  }, [problem]);

  const handleGenerateProblem = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProblem(null);
    try {
      const newProblem = await generateMathProblem(topic, difficulty);
      setProblem(newProblem);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [topic, difficulty]);
  
  const handleCopy = (textToCopy: string, type: CopiedTextType) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedTextType(type);
        setTimeout(() => setCopiedTextType(null), 2000); // Reset after 2 seconds
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
    });
  };

  const renderContentCard = (title: string, content: string, type: 'problem' | 'answer' | 'solution') => (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <button
          onClick={() => handleCopy(content, type)}
          className="flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md text-gray-600 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {copiedTextType === type ? (
            <>복사 완료!</>
          ) : (
            <><CopyIcon className="h-4 w-4" /> 복사</>
          )}
        </button>
      </div>
      <div className="text-base leading-relaxed prose max-w-none">
        <p>{content}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            수학 문제 생성 도구
          </h1>
          <p className="text-sm text-gray-600 mt-1">AI 기반 데이터베이스용 문제 콘텐츠 생성기</p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Controls */}
          <aside className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">문제 설정</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="topic" className="block text-sm font-medium text-gray-700">주제</label>
                  <select
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {TOPICS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700">난이도</label>
                  <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleGenerateProblem}
                  disabled={isLoading}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                >
                  {isLoading ? <Spinner /> : '문제 생성하기'}
                </button>
              </div>
            </div>
          </aside>

          {/* Problem Workspace */}
          <section className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow min-h-[30rem] flex flex-col">
              {isLoading && (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
                  <svg className="animate-spin h-10 w-10 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <p className="text-lg">새로운 문제를 생성 중입니다...</p>
                </div>
              )}
              {error && <div className="text-red-600 bg-red-100 p-4 rounded-md">{error}</div>}
              {!isLoading && !problem && !error && (
                 <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500">
                    <LightBulbIcon className="h-12 w-12 mb-4"/>
                    <h3 className="text-xl font-semibold">콘텐츠 생성기</h3>
                    <p className="max-w-md mt-2">주제와 난이도를 선택한 후 "문제 생성하기"를 클릭하여 문제, 정답, 풀이를 생성하세요.</p>
                </div>
              )}
              {problem && (
                <div className="space-y-4">
                  {renderContentCard("문제", problem.problem, 'problem')}
                  {renderContentCard("정답", problem.answer, 'answer')}
                  {renderContentCard("풀이", problem.solution, 'solution')}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
