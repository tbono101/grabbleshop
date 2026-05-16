/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1a1a2e',
          light: '#16213e',
          accent: '#e94560',
          gold: '#f5a623',
        },
      },
    },
  },
  plugins: [],
};
