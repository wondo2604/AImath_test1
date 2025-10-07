import React, { useState, useEffect, useCallback } from 'react';
import { getProblemsFromDb } from '../services/supabaseService';
import type { Problem } from '../types';
import Spinner from './Spinner';
import MathJaxRenderer from './MathJaxRenderer';

interface ProblemHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSupabaseConnected: boolean;
}

const ProblemHistoryModal: React.FC<ProblemHistoryModalProps> = ({ isOpen, onClose, isSupabaseConnected }) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);

  const fetchProblems = useCallback(async () => {
    if (!isSupabaseConnected) {
      setError("데이터를 불러오려면 먼저 Supabase에 연결해야 합니다.");
      setProblems([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProblemsFromDb();
      setProblems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제 기록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isSupabaseConnected]);

  useEffect(() => {
    if (isOpen) {
      fetchProblems();
    }
  }, [isOpen, fetchProblems]);

  if (!isOpen) return null;

  const toggleProblem = (id: number) => {
    setSelectedProblemId(selectedProblemId === id ? null : id);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b">
          <h2 id="history-modal-title" className="text-2xl font-bold text-gray-800">문제 기록</h2>
          <p className="text-sm text-gray-500">Supabase DB에 저장된 문제 목록입니다.</p>
        </div>
        <div className="p-6 overflow-y-auto">
          {isLoading && <div className="flex justify-center items-center h-40"><Spinner /> <span className="ml-4 text-gray-600">기록을 불러오는 중...</span></div>}
          {error && <div className="text-red-600 bg-red-100 p-4 rounded-md" role="alert">{error}</div>}
          {!isLoading && !error && problems.length === 0 && (
            <div className="text-center text-gray-500 py-10">
              <p>저장된 문제가 없습니다.</p>
              {!isSupabaseConnected && <p className="mt-2 text-sm">먼저 데이터베이스에 연결하고 문제를 저장하세요.</p>}
            </div>
          )}
          {!isLoading && !error && problems.length > 0 && (
            <div className="space-y-3">
              {problems.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg">
                  <button onClick={() => toggleProblem(p.id!)} className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center" aria-expanded={selectedProblemId === p.id}>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
                      {p.level && <span className="font-semibold text-xs text-white bg-blue-500 px-2 py-1 rounded-full">{p.level}</span>}
                      <span className="font-semibold text-indigo-700">{p.topic}</span>
                      <span className="text-sm text-gray-600 bg-gray-200 px-2 py-1 rounded">{p.difficulty}</span>
                    </div>
                    <svg className={`h-5 w-5 text-gray-500 transform transition-transform flex-shrink-0 ${selectedProblemId === p.id ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {selectedProblemId === p.id && (
                    <div className="p-4 space-y-4 border-t border-gray-200 prose max-w-none">
                       <div><h4 className="font-bold">문제:</h4><MathJaxRenderer content={p.problem} /></div>
                       <div><h4 className="font-bold">정답:</h4><MathJaxRenderer content={p.answer} /></div>
                       <div><h4 className="font-bold">풀이:</h4><MathJaxRenderer content={p.solution} /></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">닫기</button>
        </div>
      </div>
    </div>
  );
};

export default ProblemHistoryModal;