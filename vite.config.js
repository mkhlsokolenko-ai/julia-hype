import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  server: { port: 5174 },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        concept: fileURLToPath(new URL('./concept.html', import.meta.url)),
        search: fileURLToPath(new URL('./search.html', import.meta.url)),
      },
    },
  },
});
