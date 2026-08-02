import { apiFetch } from './client';

export function demanderCode(telephone: string): Promise<{ code?: string }> {
  return apiFetch('/auth/demander-code', { method: 'POST', body: { telephone } });
}

export function verifierCode(telephone: string, code: string): Promise<{ accessToken: string }> {
  return apiFetch('/auth/verifier-code', { method: 'POST', body: { telephone, code } });
}
