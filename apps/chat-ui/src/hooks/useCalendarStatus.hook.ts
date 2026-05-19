import { useState } from 'react';
import type { CalendarNavigateAction, CalendarView, StatusState } from '../types';

export function useCalendarStatus() {
  const [status, setStatus] = useState<StatusState>({ tone: 'idle', message: '' });

  function handleCalendarNavigate(action: CalendarNavigateAction, date: Date, view: CalendarView) {
    setStatus({
      tone: 'idle',
      message: `Calendar action: ${action} (${view}) -> ${date.toLocaleString()}`,
    });
  }

  function handleCalendarViewChange(view: CalendarView) {
    setStatus({ tone: 'idle', message: `Calendar view changed to ${view}.` });
  }

  return {
    status,
    setStatus,
    handleCalendarNavigate,
    handleCalendarViewChange,
  };
}