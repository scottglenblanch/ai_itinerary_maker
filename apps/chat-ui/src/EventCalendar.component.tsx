import { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { CalendarEvent, CalendarNavigateAction, CalendarView, EventCalendarProps } from './types';

const localizer = momentLocalizer(moment);

export default function EventCalendar({
  events = [],
  onSelectEvent,
  onDeleteEvent,
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

  const EventItem = ({ event, title }: { event: CalendarEvent; title: string }) => (
    <div className="calendar-event-item">
      <span className="calendar-event-item__title">{title}</span>
      <button
        type="button"
        className="calendar-event-item__delete"
        aria-label={`Delete ${event.title}`}
        onClick={(nextEvent) => {
          nextEvent.stopPropagation();
          onDeleteEvent?.(event);
        }}
      >
        x
      </button>
    </div>
  );

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
        components={{
          event: EventItem,
        }}
        onSelectSlot={(slotInfo) => onSelectSlot?.({ start: slotInfo.start as Date, end: slotInfo.end as Date })}
        onNavigate={handleNavigate}
        onView={handleView}
        selectable
      />
    </div>
  );
}
