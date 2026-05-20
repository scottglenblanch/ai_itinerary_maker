import { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { CalendarNavigateAction, CalendarView, EventCalendarProps } from './types';

const localizer = momentLocalizer(moment);

export default function EventCalendar({
  events = [],
  onSelectEvent,
  onSelectSlot,
  onNavigateAction,
  onViewChange,
}: EventCalendarProps) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');

  const handleNavigate = (nextDate: Date, nextView: string | undefined, action: string) => {
    const resolvedView = (nextView ?? view) as CalendarView;
    const resolvedAction = action as CalendarNavigateAction;
    setDate(nextDate);
    onNavigateAction?.(resolvedAction, nextDate, resolvedView);
  };

  const handleView = (nextView: string) => {
    const resolvedView = nextView as CalendarView;
    setView(resolvedView);
    onViewChange?.(resolvedView);
  };

  return (
    <div className="calendar-frame">
      <Calendar
        localizer={localizer}
        events={events}
        date={date}
        view={view}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        onNavigate={handleNavigate}
        onView={handleView}
        selectable
      />
    </div>
  );
}
