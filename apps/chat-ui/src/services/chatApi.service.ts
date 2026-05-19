import type { AskResponse, HistoryItem } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function fetchJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : `Request failed (${response.status}).`;
    throw new Error(detail);
  }

  return data as T;
}

export async function fetchHistory(username: string): Promise<HistoryItem[]> {
  const data = await fetchJson<{ history: HistoryItem[] }>('/api/v1/chat/history', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: username.trim() }),
  });

  return data.history ?? [];
}

export async function askChatQuestion(username: string, message: string): Promise<AskResponse> {
  return fetchJson<AskResponse>('/api/v1/chat/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: username.trim(), message: message.trim() }),
  });
}