const API_URL = import.meta.env.VITE_API_URL as string;
const STORAGE_KEY = 'yamba_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface RequeteOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function messageErreur(response: Response, chemin: string): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'message' in data) {
      const { message } = data as { message: unknown };
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
  } catch {
    // Corps de réponse absent ou non-JSON : on retombe sur le message générique.
  }
  return `Erreur API ${response.status} sur ${chemin}`;
}

export async function apiFetch<T>(chemin: string, options: RequeteOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${chemin}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const message = await messageErreur(response, chemin);

    // Déconnexion automatique uniquement si la requête était authentifiée :
    // un 401 sur /auth/verifier-code (mauvais code) ne doit pas déclencher de
    // redirection, la page de login doit pouvoir l'afficher elle-même.
    if (response.status === 401 && token) {
      clearToken();
      window.location.href = '/login';
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
