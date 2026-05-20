import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import EventCalendar from './EventCalendar.component';
import ChatForm from './ChatForm.component';
import HistoryPanel from './HistoryPanel.component';
import { useChatAssistant } from './hooks/useChatAssistant.hook';
import { useCalendarStatus } from './hooks/useCalendarStatus.hook';
import { useChatHistory } from './hooks/useChatHistory.hook';
import { downloadCalendarEventsAsIcs } from './services/icsExport.service';
import { getLocaleCurrencySymbol } from './services/locale.service';
import type { CalendarEvent, CalendarSlotSelection } from './types';

const CURRENCY_SYMBOL = getLocaleCurrencySymbol();

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function ChatUIApp() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCost, setManualCost] = useState('0');
  const { status, setStatus, handleCalendarNavigate, handleCalendarViewChange } = useCalendarStatus();

  const { history, historyMessage, expandedIndex, setExpandedIndex, refreshHistory } = useChatHistory(username);

  const { isSubmitting, events, canAsk, canUndo, canRedo, askQuestion, addManualEvent, removeEvent, undoEvents, redoEvents } =
    useChatAssistant({
      username,
      message,
      clearMessage: () => setMessage(''),
      refreshHistory,
      setStatus,
    });

  const handleUndoAction = useCallback(() => {
    const didUndo = undoEvents();
    if (didUndo) {
      setStatus({ tone: 'success', message: 'Undid last calendar event change.' });
    }
  }, [setStatus, undoEvents]);

  const handleRedoAction = useCallback(() => {
    const didRedo = redoEvents();
    if (didRedo) {
      setStatus({ tone: 'success', message: 'Redid last calendar event change.' });
    }
  }, [redoEvents, setStatus]);

  const handleExportAction = useCallback(() => {
    if (events.length === 0) {
      setStatus({ tone: 'error', message: 'No events to export yet.' });
      return;
    }

    downloadCalendarEventsAsIcs(events);
    setStatus({ tone: 'success', message: `Exported ${events.length} event${events.length === 1 ? '' : 's'} to an .ics file.` });
  }, [events, setStatus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isUndoShortcut = event.ctrlKey && !event.shiftKey && key === 'z';
      const isRedoShortcut = event.ctrlKey && event.shiftKey && key === 'z';

      if (!isUndoShortcut && !isRedoShortcut) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditingInput =
        tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || Boolean(target?.isContentEditable);

      if (isEditingInput) {
        return;
      }

      if (isUndoShortcut) {
        event.preventDefault();
        handleUndoAction();
        return;
      }

      event.preventDefault();
      handleRedoAction();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleRedoAction, handleUndoAction]);

  function handleSlotSelect(slotInfo: CalendarSlotSelection) {
    setManualStart(toDateTimeLocalValue(slotInfo.start));
    setManualEnd(toDateTimeLocalValue(slotInfo.end));
    setStatus({ tone: 'idle', message: 'Time slot selected. Add title/details and save the event.' });
  }

  function handleManualEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = manualTitle.trim();
    if (!title) {
      setStatus({ tone: 'error', message: 'Event title is required.' });
      return;
    }

    const start = new Date(manualStart);
    const end = new Date(manualEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setStatus({ tone: 'error', message: 'Please provide a valid start and end date/time.' });
      return;
    }

    if (end <= start) {
      setStatus({ tone: 'error', message: 'End time must be after start time.' });
      return;
    }

    const costRaw = manualCost.trim();
    const parsedCost = Number(costRaw);
    if (costRaw === '' || Number.isNaN(parsedCost) || parsedCost < 0) {
      setStatus({ tone: 'error', message: 'Cost is required and must be a non-negative number.' });
      return;
    }

    const cost = parsedCost;

    addManualEvent({
      title,
      start,
      end,
      desc: manualDescription.trim() || undefined,
      cost,
    });

    setManualTitle('');
    setManualDescription('');
    setManualCost('0');
    setStatus({ tone: 'success', message: `Event added: ${title}` });
  }

  function handleDeleteEvent(selectedEvent: CalendarEvent) {
    removeEvent(selectedEvent);
    setStatus({ tone: 'success', message: `Event deleted: ${selectedEvent.title}` });
  }

  return (
    <main className="page-shell">
      <div className="top-row">
        <section className="hero-panel">
          <ChatForm
            username={username}
            message={message}
            canAsk={canAsk}
            isSubmitting={isSubmitting}
            onUsernameChange={setUsername}
            onMessageChange={setMessage}
            onAsk={askQuestion}
          />
        </section>

        <div className="calendar-container">
          <EventCalendar
            events={events}
            onDeleteEvent={handleDeleteEvent}
            onSelectSlot={handleSlotSelect}
            onNavigateAction={handleCalendarNavigate}
            onViewChange={handleCalendarViewChange}
          />
          <form className="manual-event-form" onSubmit={handleManualEventSubmit}>
            <h2>Add Event</h2>
            <p>Click and drag a time slot to prefill the date range, or enter it manually.</p>
            <div className="manual-event-grid">
              <label className="field field--wide">
                <span>Title</span>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(nextEvent) => setManualTitle(nextEvent.target.value)}
                  placeholder="Dinner reservation"
                  required
                />
              </label>
              <label className="field">
                <span>Cost ({CURRENCY_SYMBOL})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualCost}
                  onChange={(nextEvent) => setManualCost(nextEvent.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                      e.preventDefault();
                    }
                  }}
                  required
                />
              </label>
            </div>
            <div className="manual-event-grid">
              <label className="field">
                <span>Start</span>
                <input
                  type="datetime-local"
                  value={manualStart}
                  onChange={(nextEvent) => setManualStart(nextEvent.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>End</span>
                <input
                  type="datetime-local"
                  value={manualEnd}
                  onChange={(nextEvent) => setManualEnd(nextEvent.target.value)}
                  required
                />
              </label>
            </div>
            <label className="field field--wide">
              <span>Description</span>
              <textarea
                value={manualDescription}
                onChange={(nextEvent) => setManualDescription(nextEvent.target.value)}
                placeholder="Optional details"
                rows={3}
              />
            </label>
            <div className="action-row">
              <button type="submit">Add Event To Calendar</button>
              <div className="action-row__history">
                <button
                  type="button"
                  className="button--secondary"
                  onClick={handleExportAction}
                  disabled={events.length === 0}
                  title="Download all visible events as .ics"
                >
                  Export .ics
                </button>
                <button
                  type="button"
                  className="button--secondary"
                  onClick={handleUndoAction}
                  disabled={!canUndo}
                  title="Undo (Ctrl + Z)"
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="button--secondary"
                  onClick={handleRedoAction}
                  disabled={!canRedo}
                  title="Redo (Ctrl + Shift + Z)"
                >
                  Redo
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <HistoryPanel history={history} historyMessage={historyMessage} expandedIndex={expandedIndex} onToggleExpanded={setExpandedIndex} />
    </main>
  );
}
