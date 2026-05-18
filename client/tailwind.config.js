// /client/tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5B4CF5',
        'primary-dark': '#4C3FD6',
        success: '#22C55E',
        danger: '#EF4444',
        surface: '#F9FAFB',
        'card-border': '#E5E7EB'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
