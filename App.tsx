import React, { useState, useEffect, useCallback } from 'react';
import { LEVELS, TOPICS_BY_LEVEL, DIFFICULTIES } from './constants';
import { generateMathProblem } from './services/geminiService';
import { initSupabase, saveProblemToDb } from './services/supabaseService';
import { initGoogleClient, handleAuthClick, handleSignoutClick, saveProblemToDrive } from './services/googleDriveService';
import { initMongoDb, saveProblemToMongoDb } from './services/mongoDbService';
import type { Problem } from './types';
import { Difficulty, Level } from './types';
import Spinner from './components/Spinner';
import { LightBulbIcon, CopyIcon, DatabaseIcon, CheckIcon, CheckCircleIcon, GoogleDriveIcon, HistoryIcon, MongoDbIcon, DownloadIcon, CodeIcon } from './components/icons';
import ProblemHistoryModal from './components/ProblemHistoryModal';


// MathJax global object declaration
declare global {
    interface Window {
      MathJax: {
        // FIX: Unify MathJax type definition. Methods are optional to prevent type conflicts and allow safe checking.
        typeset?: () => void;
        typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      };
      gapi: any;
      google: any;
      gapiLoaded: () => void;
      gisLoaded: () => void;
      gapiLoadPromise: Promise<void>;
      gisLoadPromise: Promise<void>;
    }
}

type CopiedTextType = 'problem' | 'answer' | 'solution' | null;
type ViewMode = 'rendered' | 'latex';

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

export default function App() {
  const [level, setLevel] = useState<Level>(Level.Middle);
  const [currentTopics, setCurrentTopics] = useState<string[]>(TOPICS_BY_LEVEL[Level.Middle]);
  const [topic, setTopic] = useState<string>(TOPICS_BY_LEVEL[Level.Middle][0]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Concept);
  const [numberOfProblems, setNumberOfProblems] = useState<number>(1);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [activeProblemIndex, setActiveProblemIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedTextType, setCopiedTextType] = useState<CopiedTextType>(null);
  
  // Supabase state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>('');
  const [isSupabaseConnecting, setIsSupabaseConnecting] = useState<boolean>(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // Google Drive state
  const [isGoogleAuthReady, setIsGoogleAuthReady] = useState<boolean>(false);
  const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState<boolean>(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState<boolean>(false);
  const [driveSaveError, setDriveSaveError] = useState<string | null>(null);
  const [driveSaveSuccess, setDriveSaveSuccess] = useState<boolean>(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isGoogleConnecting, setIsGoogleConnecting] = useState<boolean>(false);

  // MongoDB state
  const [mongoDbBackendUrl, setMongoDbBackendUrl] = useState<string>('');
  const [isMongoDbConnecting, setIsMongoDbConnecting] = useState<boolean>(false);
  const [isMongoDbConnected, setIsMongoDbConnected] = useState<boolean>(false);
  const [mongoDbError, setMongoDbError] = useState<string | null>(null);
  const [isSavingToMongo, setIsSavingToMongo] = useState<boolean>(false);
  const [mongoDbSaveSuccess, setMongoDbSaveSuccess] = useState<boolean>(false);
  const [mongoDbSaveError, setMongoDbSaveError] = useState<string | null>(null);

  // Download state
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // View mode state
  const [viewModes, setViewModes] = useState<Record<number, ViewMode>>({});


  // Modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Update topics when level changes
  useEffect(() => {
    const newTopics = TOPICS_BY_LEVEL[level];
    setCurrentTopics(newTopics);
    setTopic(newTopics[0]);
  }, [level]);

  useEffect(() => {
    const currentViewMode = viewModes[activeProblemIndex] || 'rendered';
    if (problems.length > 0 && currentViewMode === 'rendered') {
      setTimeout(() => {
        // FIX: Prefer modern `typesetPromise` and safely fall back to `typeset`.
        if (window.MathJax?.typesetPromise) {
          window.MathJax.typesetPromise();
        } else if (window.MathJax?.typeset) {
          window.MathJax.typeset();
        }
      }, 100);
    }
  }, [problems, activeProblemIndex, viewModes]);

  // Reset save statuses when changing tabs
  useEffect(() => {
    setSaveSuccess(false);
    setSaveError(null);
    setDriveSaveSuccess(false);
    setDriveSaveError(null);
    setMongoDbSaveSuccess(false);
    setMongoDbSaveError(null);
  }, [activeProblemIndex]);


  const handleGenerateProblem = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProblems([]);
    setSaveSuccess(false);
    setSaveError(null);
    setDriveSaveSuccess(false);
    setDriveSaveError(null);
    setMongoDbSaveSuccess(false);
    setMongoDbSaveError(null);
    setViewModes({});
    
    try {
      const promises = Array.from({ length: numberOfProblems }, () => 
        generateMathProblem(level, topic, difficulty)
      );
      const newProblems = await Promise.all(promises);
      setProblems(newProblems);
      setActiveProblemIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [level, topic, difficulty, numberOfProblems]);
  
  const handleSaveToDb = useCallback(async () => {
    const problemToSave = problems[activeProblemIndex];
    if (!problemToSave || !isSupabaseConnected) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveProblemToDb(problemToSave, level, topic, difficulty);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [problems, activeProblemIndex, level, topic, difficulty, isSupabaseConnected]);

  const handleSaveToDrive = useCallback(async () => {
    const problemToSave = problems[activeProblemIndex];
    if (!problemToSave || !isGoogleLoggedIn) return;

    setIsSavingToDrive(true);
    setDriveSaveError(null);
    setDriveSaveSuccess(false);
    try {
        await saveProblemToDrive(problemToSave, level, topic, difficulty);
        setDriveSaveSuccess(true);
    } catch (err) {
        setDriveSaveError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
        setIsSavingToDrive(false);
    }
  }, [problems, activeProblemIndex, level, topic, difficulty, isGoogleLoggedIn]);

  const handleSaveToMongo = useCallback(async () => {
    const problemToSave = problems[activeProblemIndex];
    if (!problemToSave || !isMongoDbConnected) return;

    setIsSavingToMongo(true);
    setMongoDbSaveError(null);
    setMongoDbSaveSuccess(false);
    try {
        await saveProblemToMongoDb(problemToSave, level, topic, difficulty);
        setMongoDbSaveSuccess(true);
    } catch (err) {
        setMongoDbSaveError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
        setIsSavingToMongo(false);
    }
  }, [problems, activeProblemIndex, level, topic, difficulty, isMongoDbConnected]);


  const handleCopy = (latexContent: string, type: CopiedTextType) => {
    const plainText = convertLatexToPlainText(latexContent);
    navigator.clipboard.writeText(plainText).then(() => {
        setCopiedTextType(type);
        setTimeout(() => setCopiedTextType(null), 2000);
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
    });
  };

  const handleSupabaseConnect = useCallback(async () => {
    setIsSupabaseConnecting(true);
    setSupabaseError(null);
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
        const success = initSupabase(supabaseUrl, supabaseAnonKey);
        if (success) {
            setIsSupabaseConnected(true);
        } else {
            throw new Error("URL과 키를 확인해주세요.");
        }
    } catch (err) {
        setSupabaseError(err instanceof Error ? err.message : '연결 실패');
        setIsSupabaseConnected(false);
    } finally {
        setIsSupabaseConnecting(false);
    }
  }, [supabaseUrl, supabaseAnonKey]);
  
  const handleGoogleConnect = useCallback(async () => {
    setIsGoogleConnecting(true);
    setGoogleAuthError(null);
    try {
        await Promise.all([window.gapiLoadPromise, window.gisLoadPromise]);
        await initGoogleClient(googleApiKey, googleClientId, setIsGoogleLoggedIn);
        setIsGoogleAuthReady(true);
        handleAuthClick(); // After successful initialization, trigger the auth flow
    } catch (error) {
        console.error("Failed to initialize Google Auth:", error);
        const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        setGoogleAuthError(`Google Drive 연결 초기화 실패: ${errorMessage}`);
        setIsGoogleAuthReady(false);
    } finally {
        setIsGoogleConnecting(false);
    }
  }, [googleApiKey, googleClientId]);

  const handleMongoDbConnect = useCallback(async () => {
    setIsMongoDbConnecting(true);
    setMongoDbError(null);
    // Simulate network delay for user feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
        // Here, we just initialize the service with the URL.
        // A real implementation might ping a /health endpoint on the backend.
        const success = initMongoDb(mongoDbBackendUrl);
        if (success) {
            setIsMongoDbConnected(true);
        } else {
            throw new Error("유효한 백엔드 서버 URL을 입력하세요.");
        }
    } catch (err) {
        setMongoDbError(err instanceof Error ? err.message : '연결 실패');
        setIsMongoDbConnected(false);
    } finally {
        setIsMongoDbConnecting(false);
    }
  }, [mongoDbBackendUrl]);


  const onSignout = () => {
    handleSignoutClick(setIsGoogleLoggedIn);
    setDriveSaveSuccess(false);
    setDriveSaveError(null);
    setIsGoogleAuthReady(false); // Reset auth ready state
  };
  
  const handleDownloadAsWord = async () => {
    if (problems.length === 0) return;

    setIsDownloading(true);
    setError(null);
    try {
        // 1. 모든 문제에 대한 원시 LaTeX로 HTML 콘텐츠 생성
        const contentHtml = problems.map((p, index) => `
            <div style="page-break-after: always;">
                <h1>문제 ${index + 1}</h1>
                <hr>
                <h2>문제</h2>
                <div>${p.problem}</div>
                <h2>정답</h2>
                <div>${p.answer}</div>
                <h2>풀이</h2>
                <div>${p.solution}</div>
            </div>
        `).join('');

        // 2. MathJax 렌더링을 위한 숨겨진 컨테이너 생성
        const renderDiv = document.createElement('div');
        renderDiv.style.visibility = 'hidden';
        renderDiv.style.position = 'absolute';
        renderDiv.style.left = '-9999px';
        renderDiv.innerHTML = contentHtml;
        document.body.appendChild(renderDiv);

        // 3. MathJax를 사용하여 수학 typesetting
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            await window.MathJax.typesetPromise([renderDiv]);
        } else {
            console.warn('MathJax.typesetPromise를 찾을 수 없습니다. typeset으로 대체합니다.');
            // FIX: Add safety check for optional `typeset` method.
            if (window.MathJax?.typeset) {
                window.MathJax.typeset();
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // 렌더링 대기
        }

        // 4. 렌더링된 HTML(SVG 포함) 가져오기
        const renderedContent = renderDiv.innerHTML;

        // 5. 숨겨진 div 정리
        document.body.removeChild(renderDiv);

        // 6. DOC 파일을 위한 최종 HTML 생성
        const staticSource = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <title>수학 문제</title>
                    <style>
                        body { font-family: 'Malgun Gothic', sans-serif; }
                        h1, h2 { color: #333; }
                        hr { border: 0; border-top: 1px solid #ccc; }
                    </style>
                </head>
                <body>
                    ${renderedContent}
                </body>
            </html>
        `;

        // 7. 다운로드 링크 생성 및 트리거
        const blob = new Blob([staticSource], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `수학_문제_${level}_${topic.split(' (')[0]}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Word 파일 생성 실패:", err);
        setError("Word 파일을 생성하는 데 실패했습니다.");
    } finally {
        setIsDownloading(false);
    }
};

  const handleToggleViewMode = () => {
    setViewModes(prev => ({
        ...prev,
        [activeProblemIndex]: (prev[activeProblemIndex] === 'latex') ? 'rendered' : 'latex'
    }));
  };

  const renderContentCard = (title: string, content: string, type: 'problem' | 'answer' | 'solution') => {
    const currentViewMode = viewModes[activeProblemIndex] || 'rendered';
    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-700">{title}</h3>
          <button
            onClick={() => handleCopy(content, type)}
            className="flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md text-gray-600 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {copiedTextType === type ? '복사 완료!' : <><CopyIcon className="h-4 w-4" /> 복사</>}
          </button>
        </div>
        {currentViewMode === 'latex' ? (
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all"><code>{content}</code></pre>
        ) : (
          <div className="text-base leading-relaxed prose max-w-none"><p>{content}</p></div>
        )}
      </div>
    );
  };
  
  const currentProblem = problems[activeProblemIndex];
  const currentViewMode = viewModes[activeProblemIndex] || 'rendered';

  return (
    <>
      <ProblemHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} isSupabaseConnected={isSupabaseConnected}/>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
        <header className="bg-white shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">수학 문제 생성 도구</h1>
              <p className="text-sm text-gray-600 mt-1">AI 기반 데이터베이스용 문제 콘텐츠 생성기</p>
            </div>
            <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <HistoryIcon className="h-5 w-5"/>
                문제 기록 보기
            </button>
          </div>
        </header>
        
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <aside className="lg:col-span-1 space-y-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">문제 설정</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="level" className="block text-sm font-medium text-gray-700">교육과정</label>
                    <select id="level" value={level} onChange={(e) => setLevel(e.target.value as Level)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-gray-700">주제</label>
                    <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      {currentTopics.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700">난이도</label>
                    <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="num-problems" className="block text-sm font-medium text-gray-700">문제 개수</label>
                    <input
                      type="number"
                      id="num-problems"
                      value={numberOfProblems}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (val > 0 && val <= 10) {
                          setNumberOfProblems(val);
                        } else if (e.target.value === '') {
                          setNumberOfProblems(1);
                        }
                      }}
                      min="1"
                      max="10"
                      className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    />
                  </div>
                  <button onClick={handleGenerateProblem} disabled={isLoading} className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">
                    {isLoading ? <Spinner /> : '문제 생성하기'}
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">데이터 연동</h2>
                
                {/* Supabase */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Supabase Database</h3>
                        {isSupabaseConnected && <span className="flex items-center text-sm font-medium text-green-600"><CheckCircleIcon className="h-5 w-5 mr-1" /> 연결됨</span>}
                    </div>
                    <div>
                        <label htmlFor="supabase-url" className="block text-sm font-medium text-gray-700">Supabase URL</label>
                        <input type="text" id="supabase-url" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} disabled={isSupabaseConnected || isSupabaseConnecting} className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" placeholder="https://..."/>
                    </div>
                    <div>
                        <label htmlFor="supabase-key" className="block text-sm font-medium text-gray-700">Supabase Anon Key</label>
                        <input type="password" id="supabase-key" value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)} disabled={isSupabaseConnected || isSupabaseConnecting} className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" placeholder="ey..."/>
                    </div>
                    {!isSupabaseConnected ? (
                        <button onClick={handleSupabaseConnect} disabled={isSupabaseConnecting || !supabaseUrl || !supabaseAnonKey} className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isSupabaseConnecting ? <Spinner /> : 'DB 연결'}
                        </button>
                    ) : (
                        <button onClick={() => setIsSupabaseConnected(false)} className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">연결 해제</button>
                    )}
                    {supabaseError && <p className="text-sm text-red-600 mt-2">{supabaseError}</p>}
                </div>

                {/* Google Drive */}
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Google Drive</h3>
                        {isGoogleLoggedIn && <span className="flex items-center text-sm font-medium text-green-600"><CheckCircleIcon className="h-5 w-5 mr-1" /> 연결됨</span>}
                    </div>

                    <div>
                        <label htmlFor="google-api-key" className="block text-sm font-medium text-gray-700">Google API Key (선택 사항)</label>
                        <input type="password" id="google-api-key" value={googleApiKey} onChange={(e) => setGoogleApiKey(e.target.value)} disabled={isGoogleLoggedIn} className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" placeholder="API 키를 입력하세요" />
                    </div>
                    <div>
                        <label htmlFor="google-client-id" className="block text-sm font-medium text-gray-700">Google Client ID</label>
                        <input type="password" id="google-client-id" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} disabled={isGoogleLoggedIn} className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" placeholder="클라이언트 ID를 입력하세요" />
                    </div>

                    {!isGoogleLoggedIn ? (
                        <button onClick={handleGoogleConnect} disabled={isGoogleConnecting || !googleClientId} className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400">
                           {isGoogleConnecting ? <Spinner /> : <><GoogleDriveIcon className="h-5 w-5 text-white" /> Google Drive 연결</>}
                        </button>
                    ) : (
                        <button onClick={onSignout} className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">연결 해제</button>
                    )}
                    {googleAuthError && <p className="text-sm text-red-600 mt-2">{googleAuthError}</p>}
                </div>
                 {/* MongoDB */}
                 <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">MongoDB (via Backend)</h3>
                        {isMongoDbConnected && <span className="flex items-center text-sm font-medium text-green-600"><CheckCircleIcon className="h-5 w-5 mr-1" /> 연결됨</span>}
                    </div>

                    <div>
                        <label htmlFor="mongodb-backend-url" className="block text-sm font-medium text-gray-700">Backend Server URL</label>
                        <input type="text" id="mongodb-backend-url" value={mongoDbBackendUrl} onChange={(e) => setMongoDbBackendUrl(e.target.value)} disabled={isMongoDbConnected || isMongoDbConnecting} className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" placeholder="https://your-backend-api.com" />
                    </div>

                    {!isMongoDbConnected ? (
                        <button onClick={handleMongoDbConnect} disabled={isMongoDbConnecting || !mongoDbBackendUrl} className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400">
                            {isMongoDbConnecting ? <Spinner /> : '백엔드 연결'}
                        </button>
                    ) : (
                        <button onClick={() => setIsMongoDbConnected(false)} className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">연결 해제</button>
                    )}
                    {mongoDbError && <p className="text-sm text-red-600 mt-2">{mongoDbError}</p>}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow min-h-[30rem] flex flex-col">
                {isLoading && <div className="flex-grow flex flex-col items-center justify-center text-gray-500"><svg className="animate-spin h-10 w-10 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p className="text-lg">새로운 문제를 생성 중입니다...</p></div>}
                {error && <div className="text-red-600 bg-red-100 p-4 rounded-md">{error}</div>}
                {!isLoading && problems.length === 0 && !error && <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500"><LightBulbIcon className="h-12 w-12 mb-4"/><h3 className="text-xl font-semibold">콘텐츠 생성기</h3><p className="max-w-md mt-2">주제와 난이도를 선택한 후 "문제 생성하기"를 클릭하여 문제, 정답, 풀이를 생성하세요.</p></div>}
                {problems.length > 0 && (
                  <div className="flex flex-col flex-grow">
                    <div className="border-b border-gray-200">
                      <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                        {problems.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setActiveProblemIndex(index)}
                            className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm focus:outline-none ${
                              activeProblemIndex === index
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            문제 {index + 1}
                          </button>
                        ))}
                      </nav>
                    </div>

                    <div className="pt-6 flex flex-col flex-grow">
                        <div className="space-y-4 flex-grow">
                            {renderContentCard("문제", currentProblem.problem, 'problem')}
                            {renderContentCard("정답", currentProblem.answer, 'answer')}
                            {renderContentCard("풀이", currentProblem.solution, 'solution')}
                        </div>
                        <div className="mt-6 border-t pt-4">
                          <div className="flex flex-wrap justify-between items-center gap-4">
                              <button
                                onClick={handleToggleViewMode}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                {currentViewMode === 'rendered' ? (
                                    <><CodeIcon className="h-5 w-5" /> LaTeX 언어로 보기</>
                                ) : (
                                    <><LightBulbIcon className="h-5 w-5" /> 결과 보기</>
                                )}
                              </button>

                              <div className="flex flex-wrap justify-end items-center gap-4">
                                {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                                {driveSaveError && <p className="text-sm text-red-600">{driveSaveError}</p>}
                                {mongoDbSaveError && <p className="text-sm text-red-600">{mongoDbSaveError}</p>}
                                
                                <button
                                    onClick={handleDownloadAsWord}
                                    disabled={isDownloading || problems.length === 0}
                                    title="모든 문제를 MS Word 파일로 다운로드"
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {isDownloading ? <Spinner /> : <><DownloadIcon className="h-5 w-5" /> Word로 다운로드</>}
                                </button>

                                <button
                                    onClick={handleSaveToDb}
                                    disabled={!isSupabaseConnected || isSaving}
                                    title={!isSupabaseConnected ? "먼저 Supabase에 연결하세요" : "Supabase에 문제 저장"}
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? <Spinner /> : <><DatabaseIcon className="h-5 w-5" /> Supabase에 저장</>}
                                    {saveSuccess && <CheckIcon className="h-5 w-5 ml-2 text-white" />}
                                </button>

                                <button
                                    onClick={handleSaveToDrive}
                                    disabled={!isGoogleLoggedIn || isSavingToDrive}
                                    title={!isGoogleLoggedIn ? "먼저 Google Drive에 연결하세요" : "Google Drive에 문제 저장"}
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {isSavingToDrive ? <Spinner /> : <><GoogleDriveIcon className="h-5 w-5" /> Drive에 저장</>}
                                    {driveSaveSuccess && <CheckIcon className="h-5 w-5 ml-2 text-white" />}
                                </button>
                                
                                <button
                                    onClick={handleSaveToMongo}
                                    disabled={!isMongoDbConnected || isSavingToMongo}
                                    title={!isMongoDbConnected ? "먼저 MongoDB 백엔드에 연결하세요" : "MongoDB에 문제 저장"}
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {isSavingToMongo ? <Spinner /> : <><MongoDbIcon className="h-5 w-5" /> MongoDB에 저장</>}
                                    {mongoDbSaveSuccess && <CheckIcon className="h-5 w-5 ml-2 text-white" />}
                                </button>
                              </div>
                          </div>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}