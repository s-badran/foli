import type { ProviderConfig, StudyState } from '../shared/models';

export async function api<Result = unknown>(
  route: string,
  options: RequestInit = {},
): Promise<Result> {
  const response = await fetch(`/api${route}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed.');
  return data as Result;
}
export function send(body: unknown, method = 'POST', key?: string): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-ai-key': key } : {}) },
    body: JSON.stringify(body),
  };
}
export const loadState = () => api<StudyState>('/state');
export const defaultConfig: ProviderConfig = {
  provider: 'offline',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  supplement: false,
};
export function displayDate(date: string, full = false) {
  return new Date(date.length === 10 ? `${date}T12:00:00` : date).toLocaleDateString(
    undefined,
    full ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' },
  );
}
export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
