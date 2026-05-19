import React from 'react';
import ReactDOM from 'react-dom/client';

import ChatUIApp from './ChatUIApp.component';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChatUIApp />
  </React.StrictMode>,
);
