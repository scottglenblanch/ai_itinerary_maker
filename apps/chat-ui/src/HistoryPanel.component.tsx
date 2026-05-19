import type { HistoryItem } from './types';

type HistoryPanelProps = {
  history: HistoryItem[];
  historyMessage: string;
  expandedIndex: number | null;
  onToggleExpanded: (index: number | null) => void;
};

export default function HistoryPanel({ history, historyMessage, expandedIndex, onToggleExpanded }: HistoryPanelProps) {
  return (
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
              <button className="history-summary" type="button" onClick={() => onToggleExpanded(isExpanded ? null : index)}>
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
  );
}