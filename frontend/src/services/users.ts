import { API_BASE_URL } from '../config/api';
import type { UserRole } from './auth';

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'staff' | 'admin';
};

type UsersResponse = {
  users: ManagedUser[];
};

type UserResponse = {
  user: ManagedUser;
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

export async function fetchUsers(token: string, role?: UserRole): Promise<ManagedUser[]> {
  const params = role ? `?role=${encodeURIComponent(role)}` : '';
  const response = await fetch(`${API_BASE_URL}/users${params}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as UsersResponse;
  return data.users;
}

export async function createUserAccount(
  token: string,
  payload: CreateUserPayload
): Promise<ManagedUser> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as UserResponse;
  return data.user;
}
