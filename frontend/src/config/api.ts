export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:4000/api/v1';

export const API_ORIGIN_URL = API_BASE_URL.replace(/\/api\/v\d+$/, '');
