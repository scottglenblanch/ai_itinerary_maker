import { useEffect, useMemo, useState } from 'react';

type HistoryItem = {
  question: string;
  answer: string;
};

type AskResponse = {
  response: string;
  ics_download_url: string | null;
};

type StatusState = {
  tone: 'idle' | 'success' | 'error' | 'loading';
  message: string;
};

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

export default function App() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<StatusState>({ tone: 'idle', message: '' });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyMessage, setHistoryMessage] = useState('Type at least 5 characters in username to load history.');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAsk = useMemo(() => username.trim().length > 0 && message.trim().length > 0 && !isSubmitting, [username, message, isSubmitting]);

  useEffect(() => {
    if (username.trim().length < 5) {
      setHistory([]);
      setHistoryMessage('Type at least 5 characters in username to load history.');
      return;
    }

    setHistoryMessage('Loading history...');

    const timer = window.setTimeout(() => {
      fetchJson<{ history: HistoryItem[] }>('/api/v1/chat/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      })
        .then((data) => {
          setHistory(data.history ?? []);
          setHistoryMessage(data.history?.length ? `Loaded ${data.history.length} previous item${data.history.length === 1 ? '' : 's'}.` : 'No history found for this user yet.');
          setExpandedIndex(null);
        })
        .catch((error: unknown) => {
          const messageText = error instanceof Error ? error.message : 'Unknown error';
          setHistory([]);
          setHistoryMessage(`Failed to load history: ${messageText}`);
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [username]);

  async function askQuestion() {
    if (!canAsk) {
      return;
    }

    setIsSubmitting(true);
    setStatus({ tone: 'loading', message: 'Sending request...' });
    setDownloadUrl(null);

    try {
      const data = await fetchJson<AskResponse>('/api/v1/chat/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), message: message.trim() }),
      });

      setStatus({ tone: 'success', message: data.response || '(No response field returned)' });
      setDownloadUrl(data.ics_download_url);
      setMessage('');
      setHistoryMessage('Refreshing history...');
      setExpandedIndex(null);

      const refreshedHistory = await fetchJson<{ history: HistoryItem[] }>('/api/v1/chat/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      setHistory(refreshedHistory.history ?? []);
      setHistoryMessage(refreshedHistory.history?.length ? `Loaded ${refreshedHistory.history.length} previous item${refreshedHistory.history.length === 1 ? '' : 's'}.` : 'No history found for this user yet.');
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ tone: 'error', message: `Error: ${messageText}` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="eyebrow">chat-ui</div>
        <h1>Ask itinerary questions with a cleaner, separate frontend.</h1>
        <p>
          This React app talks to <span>chat-api</span> for chat responses, history, and ICS downloads.
        </p>

        <div className="form-grid">
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. scott"
              autoComplete="nickname"
            />
          </label>

          <label className="field field--wide">
            <span>Question</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Give the chatbot details about your itinerary request..."
              rows={6}
            />
          </label>
        </div>

        <div className="action-row">
          <button type="button" onClick={askQuestion} disabled={!canAsk}>
            {isSubmitting ? 'Asking...' : 'Ask'}
          </button>
          {downloadUrl ? (
            <a className="download-link" href={downloadUrl} download="itinerary.ics">
              Download itinerary calendar
            </a>
          ) : null}
        </div>

        <section className={`status-card status-card--${status.tone}`} aria-live="polite">
          <h2>{status.tone === 'success' ? 'Response' : status.tone === 'error' ? 'Error' : 'Status'}</h2>
          <p>{status.message || 'Ask a question to see the latest response here.'}</p>
        </section>
      </section>

      <aside className="history-panel" aria-live="polite">
        <div className="history-header">
          <h2>Previous Questions</h2>
          <p>{historyMessage}</p>
        </div>

        <div className="history-list">
          {history.map((item, index) => {
            const isExpanded = expandedIndex === index;
            const preview = item.question.split(/\r?\n/)[0] || '(No question)';

            return (
              <article key={`${index}-${preview}`} className="history-item">
                <button className="history-summary" type="button" onClick={() => setExpandedIndex(isExpanded ? null : index)}>
                  <span>{preview}</span>
                  <span>{isExpanded ? 'Hide' : 'Show all'}</span>
                </button>

                {isExpanded ? (
                  <div className="history-details">
                    <p>
                      <strong>Q:</strong> {item.question}
                    </p>
                    <p>
                      <strong>A:</strong> {item.answer}
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
