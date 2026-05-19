type ChatFormProps = {
  username: string;
  message: string;
  canAsk: boolean;
  isSubmitting: boolean;
  onUsernameChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onAsk: () => void;
};

export default function ChatForm({
  username,
  message,
  canAsk,
  isSubmitting,
  onUsernameChange,
  onMessageChange,
  onAsk,
}: ChatFormProps) {
  return (
    <>
      <div className="eyebrow">chat-ui</div>
      <p>
        This React app talks to <span>chat-api</span> for chat responses, history, and ICS event payloads.
      </p>

      <div className="form-grid">
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="e.g. scott" autoComplete="nickname" />
        </label>

        <label className="field field--wide">
          <span>Question</span>
          <textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Give the chatbot details about your itinerary request..."
            rows={6}
          />
        </label>
      </div>

      <div className="action-row">
        <button type="button" onClick={onAsk} disabled={!canAsk}>
          {isSubmitting ? 'Asking...' : 'Ask'}
        </button>
      </div>
    </>
  );
}