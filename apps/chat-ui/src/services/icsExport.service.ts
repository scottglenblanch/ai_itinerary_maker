import type { CalendarEvent } from '../types';

function padTwoDigits(value: number) {
  return String(value).padStart(2, '0');
}

function formatUtcDateTime(date: Date) {
  return `${date.getUTCFullYear()}${padTwoDigits(date.getUTCMonth() + 1)}${padTwoDigits(date.getUTCDate())}T${padTwoDigits(date.getUTCHours())}${padTwoDigits(date.getUTCMinutes())}${padTwoDigits(date.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function sanitizeUidPart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

function buildIcsContent(events: CalendarEvent[]) {
  const stamp = formatUtcDateTime(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//itinerary-maker//chat-ui//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event, index) => {
    const uidBase = event.id != null ? String(event.id) : `event-${index + 1}`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${sanitizeUidPart(uidBase)}@itinerary-maker.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${formatUtcDateTime(event.start)}`);
    lines.push(`DTEND:${formatUtcDateTime(event.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    const descParts: string[] = [];
    if (event.desc) {
      descParts.push(event.desc);
    }
    if (event.cost != null) {
      descParts.push(`Cost: ${event.cost}`);
    }
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`);
    }
    if (event.cost != null) {
      lines.push(`X-COST:${event.cost}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function createExportFilename() {
  const now = new Date();
  const dateStamp = `${now.getFullYear()}${padTwoDigits(now.getMonth() + 1)}${padTwoDigits(now.getDate())}`;
  const timeStamp = `${padTwoDigits(now.getHours())}${padTwoDigits(now.getMinutes())}`;
  return `calendar-events-${dateStamp}-${timeStamp}.ics`;
}

export function downloadCalendarEventsAsIcs(events: CalendarEvent[]) {
  const icsContent = buildIcsContent(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = createExportFilename();
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);
}