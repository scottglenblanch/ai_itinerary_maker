import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { askChatQuestion } from '../services/chatApi.service';
import type { CalendarEvent, StatusState } from '../types';

type UseChatAssistantParams = {
  username: string;
  message: string;
  clearMessage: () => void;
  refreshHistory: (loadingMessage?: string) => Promise<void>;
  setStatus: Dispatch<SetStateAction<StatusState>>;
};

type IcsPayloadEvent = {
  title?: string;
  start?: string;
  end?: string;
  description?: string;
};

type IcsPayload = {
  events?: IcsPayloadEvent[];
};

function parseIcsPayloadJson(payloadJson: string): CalendarEvent[] {
  let parsed: IcsPayload;

  try {
    parsed = JSON.parse(payloadJson) as IcsPayload;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.events)) {
    return [];
  }

  const events: CalendarEvent[] = [];

  for (const [index, event] of parsed.events.entries()) {
    if (typeof event?.title !== 'string' || typeof event?.start !== 'string' || typeof event?.end !== 'string') {
      continue;
    }

    const start = new Date(event.start);
    const end = new Date(event.end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }

    events.push({
      id: index,
      title: event.title,
      start,
      end,
      desc: typeof event.description === 'string' ? event.description : undefined,
    });
  }

  return events;
}

export function useChatAssistant({ username, message, clearMessage, refreshHistory, setStatus }: UseChatAssistantParams) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const canAsk = useMemo(
    () => username.trim().length > 0 && message.trim().length > 0 && !isSubmitting,
    [username, message, isSubmitting],
  );

  async function askQuestion() {
    if (!canAsk) {
      return;
    }

    setIsSubmitting(true);
    setStatus({ tone: 'loading', message: 'Sending request...' });

    try {
      const data = await askChatQuestion(username, message);

      setStatus({ tone: 'success', message: data.response || '(No response field returned)' });
      clearMessage();

      if (data.ics_payload_json) {
        const parsedEvents = parseIcsPayloadJson(data.ics_payload_json);
        if (parsedEvents.length > 0) {
          setEvents((prevEvents) => [...prevEvents, ...parsedEvents]);
        }
      }

      await refreshHistory('Refreshing history...');
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ tone: 'error', message: `Error: ${messageText}` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    isSubmitting,
    events,
    canAsk,
    askQuestion,
  };
}