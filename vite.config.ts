import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()], test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"] }, server: { proxy: { "/api/review": "http://127.0.0.1:3001" } } });
