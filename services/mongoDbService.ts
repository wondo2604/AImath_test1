import type { Problem, Difficulty, Level } from '../types';

let backendUrl: string | null = null;

export const initMongoDb = (url: string): boolean => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    try {
      new URL(url);
      backendUrl = url;
      console.log("MongoDB backend service initialized with URL:", backendUrl);
      return true;
    } catch (error) {
      console.error("Invalid backend URL provided for MongoDB service:", error);
      backendUrl = null;
      return false;
    }
  }
  console.error("A valid backend URL (starting with http:// or https://) is required for MongoDB service initialization.");
  return false;
};

export const saveProblemToMongoDb = async (problemData: Problem, level: Level, topic: string, difficulty: Difficulty): Promise<void> => {
  if (!backendUrl) {
    throw new Error("MongoDB 백엔드 서비스가 초기화되지 않았습니다. 먼저 백엔드에 연결하세요.");
  }

  const payload = {
    ...problemData,
    level,
    topic,
    difficulty,
  };

  try {
    // Use a common API endpoint convention like /api/problems
    const endpoint = new URL('api/problems', backendUrl).toString();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `서버 오류: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Ignore if response body is not JSON.
      }
      throw new Error(`MongoDB에 문제를 저장하는 데 실패했습니다: ${errorMessage}`);
    }

    console.log('Problem saved successfully to MongoDB via backend.');
  } catch (error) {
    console.error('Error saving to MongoDB via backend:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('백엔드 서버에 연결할 수 없습니다. URL 및 네트워크 연결을 확인하세요.');
    }
    // Re-throw the original or constructed error to be handled by the UI.
    throw error;
  }
};
