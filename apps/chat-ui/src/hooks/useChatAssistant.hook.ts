import { useMemo, useReducer, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { askChatQuestion } from '../services/chatApi.service';
import type { CalendarEvent, CreateCalendarEventInput, StatusState } from '../types';

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

type EventHistoryState = {
  past: CalendarEvent[][];
  present: CalendarEvent[];
  future: CalendarEvent[][];
};

type EventHistoryAction =
  | { type: 'apply'; mutateEvents: (currentEvents: CalendarEvent[]) => CalendarEvent[] }
  | { type: 'undo' }
  | { type: 'redo' };

const initialEventHistoryState: EventHistoryState = {
  past: [],
  present: [],
  future: [],
};

function eventHistoryReducer(state: EventHistoryState, action: EventHistoryAction): EventHistoryState {
  if (action.type === 'apply') {
    const nextEvents = action.mutateEvents(state.present);

    if (nextEvents === state.present) {
      return state;
    }

    return {
      past: [...state.past, state.present],
      present: nextEvents,
      future: [],
    };
  }

  if (action.type === 'undo') {
    if (state.past.length === 0) {
      return state;
    }

    const previousEvents = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: previousEvents,
      future: [...state.future, state.present],
    };
  }

  if (state.future.length === 0) {
    return state;
  }

  const nextEvents = state.future[state.future.length - 1];
  return {
    past: [...state.past, state.present],
    present: nextEvents,
    future: state.future.slice(0, -1),
  };
}

let generatedEventIdCounter = 0;

function createGeneratedEventId(prefix: string) {
  generatedEventIdCounter += 1;
  return `${prefix}-${Date.now()}-${generatedEventIdCounter}`;
}

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
      id: createGeneratedEventId(`ai-${index}`),
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
  const [eventHistory, dispatchEventHistory] = useReducer(eventHistoryReducer, initialEventHistoryState);
  const events = eventHistory.present;

  const canAsk = useMemo(
    () => username.trim().length > 0 && message.trim().length > 0 && !isSubmitting,
    [username, message, isSubmitting],
  );

  const canUndo = eventHistory.past.length > 0;
  const canRedo = eventHistory.future.length > 0;

  function applyEventMutation(mutateEvents: (currentEvents: CalendarEvent[]) => CalendarEvent[]) {
    dispatchEventHistory({ type: 'apply', mutateEvents });
  }

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
          applyEventMutation((prevEvents) => [...prevEvents, ...parsedEvents]);
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

  function addManualEvent(eventInput: CreateCalendarEventInput) {
    applyEventMutation((prevEvents) => [
      ...prevEvents,
      {
        id: createGeneratedEventId('manual'),
        title: eventInput.title,
        start: eventInput.start,
        end: eventInput.end,
        desc: eventInput.desc,
        cost: eventInput.cost,
      },
    ]);
  }

  function removeEvent(eventToRemove: CalendarEvent) {
    applyEventMutation((prevEvents) => {
      const remainingEvents = prevEvents.filter((existingEvent) => {
        if (eventToRemove.id != null && existingEvent.id != null) {
          return existingEvent.id !== eventToRemove.id;
        }

        return !(
          existingEvent.title === eventToRemove.title &&
          existingEvent.start.getTime() === eventToRemove.start.getTime() &&
          existingEvent.end.getTime() === eventToRemove.end.getTime() &&
          existingEvent.desc === eventToRemove.desc
        );
      });

      if (remainingEvents.length === prevEvents.length) {
        return prevEvents;
      }

      return remainingEvents;
    });
  }

  function undoEvents() {
    if (!canUndo) {
      return false;
    }

    dispatchEventHistory({ type: 'undo' });
    return true;
  }

  function redoEvents() {
    if (!canRedo) {
      return false;
    }

    dispatchEventHistory({ type: 'redo' });
    return true;
  }

  return {
    isSubmitting,
    events,
    canAsk,
    canUndo,
    canRedo,
    askQuestion,
    addManualEvent,
    removeEvent,
    undoEvents,
    redoEvents,
  };
}