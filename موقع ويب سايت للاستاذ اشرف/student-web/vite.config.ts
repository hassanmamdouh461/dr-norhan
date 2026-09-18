import { resolve } from 'path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        courses: resolve(__dirname, 'courses.html'),
        courseDetails: resolve(__dirname, 'course-details.html'),
        lesson: resolve(__dirname, 'lesson.html'),
        exam: resolve(__dirname, 'exam.html'),
        bank: resolve(__dirname, 'bank.html'),
        dictionary: resolve(__dirname, 'dictionary.html'),
        wallet: resolve(__dirname, 'wallet.html'),
        parent: resolve(__dirname, 'parent.html'),
        profile: resolve(__dirname, 'profile.html'),
      },
    },
  },
});
