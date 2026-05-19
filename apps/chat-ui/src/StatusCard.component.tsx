import type { StatusState } from './types';

type StatusCardProps = {
  status: StatusState;
};

export default function StatusCard({ status }: StatusCardProps) {
  const heading = status.tone === 'success' ? 'Response' : status.tone === 'error' ? 'Error' : 'Status';

  return (
    <section className={`status-card status-card--${status.tone}`} aria-live="polite">
      <h2>{heading}</h2>
      <p>{status.message || 'Ask a question to see the latest response here.'}</p>
    </section>
  );
}