
import React, { useState, useEffect, useCallback } from 'react';
import { TOPICS, DIFFICULTIES } from './constants';
import { generateMathProblem, generateFollowUpProblem } from './services/geminiService';
import type { Problem } from './types';
import { Difficulty } from './types';
import Spinner from './components/Spinner';
import { CheckCircleIcon, XCircleIcon, LightBulbIcon } from './components/icons';

// MathJax global object declaration
declare global {
    interface Window {
      MathJax: {
        typeset: () => void;
      };
    }
}

export default function App() {
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Concept);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
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

  const resetProblemState = () => {
    setUserAnswer('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setError(null);
  };

  const fetchProblem = useCallback(async (fetchFn: () => Promise<Problem>) => {
    setIsLoading(true);
    resetProblemState();
    setProblem(null);
    try {
      const newProblem = await fetchFn();
      setProblem(newProblem);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGenerateProblem = () => {
    fetchProblem(() => generateMathProblem(topic, difficulty));
  };

  const handleFollowUpProblem = (correct: boolean) => {
    if (!problem) return;
    const lastProblem = problem;
    const lastAnswer = userAnswer;
    fetchProblem(() => generateFollowUpProblem(lastProblem, lastAnswer, correct));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem || userAnswer.trim() === '') return;
    // Normalize answers: remove spaces and compare. Consider more robust normalization for complex answers.
    const correctAnswer = problem.answer.toString().trim().toLowerCase();
    const normalizedUserAnswer = userAnswer.trim().toLowerCase();
    
    setIsCorrect(correctAnswer === normalizedUserAnswer);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            개인 맞춤형 수학 연습
          </h1>
          <p className="text-sm text-gray-600 mt-1">AI 기반 중학교 수학 문제 생성</p>
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
                    <h3 className="text-xl font-semibold">환영합니다!</h3>
                    <p className="max-w-md mt-2">주제와 난이도를 선택한 후 "문제 생성하기"를 클릭하여 맞춤형 연습을 시작하세요.</p>
                </div>
              )}
              {problem && (
                <div className="flex-grow flex flex-col">
                  <div id="problem-statement" className="text-lg leading-relaxed mb-6 prose max-w-none">
                    <p>{problem.problem}</p>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="mt-auto">
                    <div className="flex items-center gap-4">
                      <input
                        type="text"
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="정답을 입력하세요"
                        disabled={isSubmitted}
                        className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                        aria-label="Answer input"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitted || isLoading}
                        className="px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400"
                      >
                        제출
                      </button>
                    </div>
                  </form>
                  
                  {isSubmitted && (
                    <div className="mt-6">
                      <div className={`p-4 rounded-md flex items-start gap-3 ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isCorrect ? <CheckCircleIcon className="h-6 w-6 text-green-500" /> : <XCircleIcon className="h-6 w-6 text-red-500" />}
                        <div>
                          <h3 className="font-bold">{isCorrect ? '정답입니다!' : '오답입니다'}</h3>
                          <p className="text-sm mt-1">
                            정답은 <strong>{problem.answer}</strong> 입니다.
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-4 border rounded-md bg-gray-50">
                        <h4 className="font-semibold text-gray-700 mb-2">풀이:</h4>
                        <div id="solution" className="text-sm prose max-w-none">
                            <p>{problem.solution}</p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row gap-4">
                        <button 
                          onClick={() => handleFollowUpProblem(true)}
                          className="w-full sm:w-auto flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          다음 문제 (더 어렵게)
                        </button>
                        {!isCorrect && (
                           <button 
                             onClick={() => handleFollowUpProblem(false)}
                             className="w-full sm:w-auto flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                           >
                             비슷한 문제 (더 쉽게)
                           </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}