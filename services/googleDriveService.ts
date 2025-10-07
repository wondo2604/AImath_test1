import type { Problem, Level } from '../types';
import { Difficulty } from '../types';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let gapi: any;
let tokenClient: any;
let google: any;

export const initGoogleClient = (
    apiKey: string,
    clientId: string,
    updateAuthStatus: (isSignedIn: boolean) => void
): Promise<void> => {
    gapi = window.gapi;
    google = window.google;

    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    // API 키는 사용자 데이터에 접근하는 OAuth 흐름에 필요하지 않으며,
                    // 잘못된 키는 'API discovery response missing required fields' 오류의 일반적인 원인입니다.
                    // apiKey: apiKey,
                    discoveryDocs: [DISCOVERY_DOC],
                });

                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: SCOPES,
                    callback: (tokenResponse: any) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            gapi.client.setToken({ access_token: tokenResponse.access_token });
                            updateAuthStatus(true);
                        } else {
                            console.log("User did not grant access.");
                            updateAuthStatus(false);
                        }
                    },
                    error_callback: (error: any) => {
                        console.error('Authentication error:', error);
                        // Provide a user-friendly error message for common configuration issues.
                        if (error && (error.type === 'popup_closed' || error.type === 'popup_failed_to_open')) {
                            // This is a common, less critical error.
                            // No need to throw, but you could set a state to inform the user.
                        } else if (error && error.details?.includes('origin_mismatch')) {
                            reject(new Error("인증 오류: Google Cloud Console에서 '승인된 자바스크립트 출처'를 확인하세요. 현재 앱의 주소와 일치해야 합니다."));
                        } else {
                            reject(new Error(`Google 인증 중 오류가 발생했습니다: ${error?.details || '알 수 없는 오류'}`));
                        }
                    }
                });
                resolve();
            } catch (error) {
                console.error('Error initializing Google Client:', error);
                const detailedError = new Error(
                    'Google Client 초기화에 실패했습니다. Client ID가 유효한지, 그리고 Google Cloud Console에서 Drive API가 활성화되었는지 확인하세요.'
                );
                if (error instanceof Error) {
                    detailedError.message += `\n원래 오류: ${error.message}`;
                }
                reject(detailedError);
            }
        });
    });
};

export const handleAuthClick = () => {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.error("Google 토큰 클라이언트가 초기화되지 않았습니다.");
    }
};

export const handleSignoutClick = (updateAuthStatus: (isSignedIn: boolean) => void) => {
    if (gapi && google) {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken(null);
                updateAuthStatus(false);
            });
        }
    }
};

const createProblemFileContent = (problemData: Problem, level: Level, topic: string, difficulty: Difficulty): string => {
    return `
교육과정: ${level}
주제: ${topic}
난이도: ${difficulty}

====================
문제
====================
${problemData.problem}

====================
정답
====================
${problemData.answer}

====================
풀이
====================
${problemData.solution}
    `.trim();
};

export const saveProblemToDrive = async (problemData: Problem, level: Level, topic: string, difficulty: Difficulty): Promise<void> => {
    if (!gapi || !gapi.client.getToken()) {
        throw new Error("Google Drive에 로그인되어 있지 않습니다.");
    }

    const fileContent = createProblemFileContent(problemData, level, topic, difficulty);
    const fileName = `수학 문제 - ${level} - ${topic.split(' (')[0]} - ${new Date().toISOString()}.txt`;
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
        name: fileName,
        mimeType: 'text/plain'
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
        fileContent +
        close_delim;

    try {
        const request = await gapi.client.request({
            'path': 'https://www.googleapis.com/upload/drive/v3/files',
            'method': 'POST',
            'params': { 'uploadType': 'multipart' },
            'headers': {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody
        });
        if (request.status !== 200) {
            console.error('Google Drive API Error:', request);
            throw new Error(`Google Drive에 저장하는 데 실패했습니다. 응답 코드: ${request.status}`);
        }
    } catch (error) {
        console.error("Google Drive 저장 오류:", error);
        throw new Error("Google Drive에 문제를 저장하는 데 실패했습니다. 자세한 내용은 콘솔을 확인하세요.");
    }
};