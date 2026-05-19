import { useCallback, useEffect, useState } from 'react';
import { fetchHistory } from '../services/chatApi.service';
import type { HistoryItem } from '../types';

const SHORT_USERNAME_MESSAGE = 'Type at least 5 characters in username to load history.';

function toHistoryMessage(history: HistoryItem[]): string {
  return history.length
    ? `Loaded ${history.length} previous item${history.length === 1 ? '' : 's'}.`
    : 'No history found for this user yet.';
}

export function useChatHistory(username: string) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyMessage, setHistoryMessage] = useState(SHORT_USERNAME_MESSAGE);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const refreshHistory = useCallback(
    async (loadingMessage = 'Loading history...') => {
      if (username.trim().length < 5) {
        setHistory([]);
        setHistoryMessage(SHORT_USERNAME_MESSAGE);
        setExpandedIndex(null);
        return;
      }

      setHistoryMessage(loadingMessage);

      try {
        const historyItems = await fetchHistory(username);
        setHistory(historyItems);
        setHistoryMessage(toHistoryMessage(historyItems));
        setExpandedIndex(null);
      } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : 'Unknown error';
        setHistory([]);
        setHistoryMessage(`Failed to load history: ${messageText}`);
      }
    },
    [username],
  );

  useEffect(() => {
    if (username.trim().length < 5) {
      setHistory([]);
      setHistoryMessage(SHORT_USERNAME_MESSAGE);
      setExpandedIndex(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshHistory('Loading history...');
    }, 300);

    return () => window.clearTimeout(timer);
  }, [username, refreshHistory]);

  return {
    history,
    historyMessage,
    expandedIndex,
    setExpandedIndex,
    refreshHistory,
  };
}