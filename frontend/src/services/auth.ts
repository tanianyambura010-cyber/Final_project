import { API_BASE_URL } from '../config/api';

export type UserRole = 'customer' | 'staff' | 'rider' | 'admin';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

type ApiErrorBody = {
  message?: string;
};

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function authRequest(path: string, body: unknown): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as AuthSession;
}

export function login(email: string, password: string, role?: UserRole) {
  return authRequest('/auth/login', { email, password, role });
}

export function register(name: string, email: string, phone: string, password: string) {
  return authRequest('/auth/register', { name, email, phone, password });
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const body = (await response.json()) as { user: AuthUser };
  return body.user;
}
