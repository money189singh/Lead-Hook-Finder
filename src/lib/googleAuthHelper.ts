import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import appletConfig from '../../firebase-applet-config.json';
import { GoogleSheetsSyncStats } from '../types';

export interface GoogleAuthStatus {
  connected: boolean;
  email?: string;
  name?: string;
  connectedAt?: string;
  isExpired?: boolean;
}

/**
 * Checks connection status with backend token store
 */
export async function checkGoogleSheetsConnection(email?: string): Promise<GoogleAuthStatus> {
  try {
    const url = email ? `/api/sheets/status?email=${encodeURIComponent(email)}` : '/api/sheets/status';
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[GoogleAuthHelper] Failed to check status:', err);
  }
  return { connected: false };
}

/**
 * Requests a fresh access token from Google (using GIS or Firebase popup)
 * and registers it with the backend worker token store.
 */
export async function requestFreshGoogleToken(promptMode: 'consent' | '' = 'consent'): Promise<{
  accessToken: string;
  email: string;
  name: string;
}> {
  const clientId = (appletConfig as any)?.oAuthClientId;

  // 1. Try Google Identity Services (GIS)
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && clientId) {
    return new Promise((resolve, reject) => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
          prompt: promptMode,
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.warn('[GIS Error]', tokenResponse);
              reject(new Error(tokenResponse.error_description || tokenResponse.error || 'Authorization was cancelled'));
              return;
            }

            const accessToken = tokenResponse.access_token;
            let userEmail = 'moneysinghgtme@gmail.com';
            let userName = 'Google User';

            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (userInfoRes.ok) {
                const u = await userInfoRes.json();
                userEmail = u.email || userEmail;
                userName = u.name || userName;
              }
            } catch {}

            // Save to backend
            const connectRes = await fetch('/api/sheets/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                name: userName,
                accessToken,
                expiresIn: tokenResponse.expires_in || 3600,
              }),
            });

            if (!connectRes.ok) {
              reject(new Error('Failed to register token with backend worker.'));
              return;
            }

            resolve({ accessToken, email: userEmail, name: userName });
          },
        });
        tokenClient.requestAccessToken();
      } catch (err: any) {
        reject(err);
      }
    });
  }

  // 2. Fallback to Firebase Popup
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error('Could not obtain Google OAuth access token.');
  }

  const userEmail = result.user.email || 'moneysinghgtme@gmail.com';
  const userName = result.user.displayName || 'Google User';

  await fetch('/api/sheets/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      name: userName,
      accessToken,
      expiresIn: 3600,
    }),
  });

  return { accessToken, email: userEmail, name: userName };
}

/**
 * Triggers a manual sync of a schedule to Google Sheets.
 * If authentication has expired, automatically prompts for reconnection and completes sync!
 */
export async function triggerScheduleGoogleSheetsSync(
  scheduleId: string,
  existingToken?: string
): Promise<{ success: boolean; stats: GoogleSheetsSyncStats; reauthenticated?: boolean }> {
  let token = existingToken;

  const trySync = async (t?: string) => {
    const res = await fetch(`/api/sheets/sync-schedule/${scheduleId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ accessToken: t }),
    });
    return await res.json();
  };

  let result = await trySync(token);

  // If token is expired or authentication required, prompt re-authorization and retry once!
  if (
    !result.success ||
    result.stats?.status === 'Authentication Required' ||
    result.error?.includes('authorization') ||
    result.error?.includes('401')
  ) {
    console.log('[GoogleAuthHelper] Authentication required. Prompting 1-click Google authorization...');
    const fresh = await requestFreshGoogleToken('consent');
    token = fresh.accessToken;
    result = await trySync(token);
    return { ...result, reauthenticated: true };
  }

  return result;
}
