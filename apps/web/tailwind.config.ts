import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Custom colors for FitGrade grade labels
      colors: {
        grade: {
          excellent: '#16a34a', // מצטיין — green-600
          good: '#2563eb',      // טוב מאוד / טוב — blue-600
          pass: '#d97706',      // עובר — amber-600
          fail: '#dc2626',      // נכשל — red-600
        },
      },
      fontFamily: {
        // Hebrew-first font stack: system fonts that render Hebrew well
        sans: [
          'Segoe UI',
          'Arial',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
