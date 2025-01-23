import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Repo1/', // Replace 'your-repo-name' with the repository name
  plugins: [react()],
});
