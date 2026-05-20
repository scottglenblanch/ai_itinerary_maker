export type HistoryItem = {
  question: string;
  answer: string;
};

export type AskResponse = {
  response: string;
  ics_payload_json: string | null;
};

export type StatusState = {
  tone: 'idle' | 'success' | 'error' | 'loading';
  message: string;
};

export type CalendarEvent = {
  id?: string | number;
  title: string;
  start: Date;
  end: Date;
  desc?: string;
  cost: number;
};

export type CreateCalendarEventInput = {
  title: string;
  start: Date;
  end: Date;
  desc?: string;
  cost: number;
};

export type CalendarSlotSelection = {
  start: Date;
  end: Date;
};

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export type CalendarNavigateAction = 'PREV' | 'NEXT' | 'TODAY' | 'DATE';

export type EventCalendarProps = {
  events?: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: CalendarSlotSelection) => void;
  onNavigateAction?: (action: CalendarNavigateAction, date: Date, view: CalendarView) => void;
  onViewChange?: (view: CalendarView) => void;
};
