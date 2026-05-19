import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const workspaceRoot = decodeURIComponent(new URL('../../', import.meta.url).pathname);
  const env = loadEnv(mode, workspaceRoot, '');
  const uiPort = Number(env.UI_PORT ?? 5173);
  const apiPort = Number(env.API_PORT ?? 8000);

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: Number.isFinite(uiPort) ? uiPort : 5173,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${Number.isFinite(apiPort) ? apiPort : 8000}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  };
});
