import { useState } from 'react';
import EventCalendar from './EventCalendar.component';
import ChatForm from './ChatForm.component';
import HistoryPanel from './HistoryPanel.component';
import StatusCard from './StatusCard.component';
import { useChatAssistant } from './hooks/useChatAssistant.hook';
import { useCalendarStatus } from './hooks/useCalendarStatus.hook';
import { useChatHistory } from './hooks/useChatHistory.hook';

export default function ChatUIApp() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const { status, setStatus, handleCalendarNavigate, handleCalendarViewChange } = useCalendarStatus();

  const { history, historyMessage, expandedIndex, setExpandedIndex, refreshHistory } = useChatHistory(username);

  const { isSubmitting, events, canAsk, askQuestion } = useChatAssistant({
    username,
    message,
    clearMessage: () => setMessage(''),
    refreshHistory,
    setStatus,
  });

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
          <StatusCard status={status} />
        </section>

        <div className="calendar-container">
          <EventCalendar events={events} onNavigateAction={handleCalendarNavigate} onViewChange={handleCalendarViewChange} />
        </div>
      </div>

      <HistoryPanel history={history} historyMessage={historyMessage} expandedIndex={expandedIndex} onToggleExpanded={setExpandedIndex} />
    </main>
  );
}
