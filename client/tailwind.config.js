/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-base':    '#0a0a0a',
        'dark-surface': '#111111',
        'dark-card':    '#161616',
        'dark-border':  '#222222',
        'dark-hover':   '#2a2a2a',
        'brand':        '#FFB800', // Punchline amber/gold
        'brand-light':  '#FFC933',
        'brand-dark':   '#E0A500',
        'text-primary':   '#FFFFFF',
        'text-secondary': '#AAAAAA',
        'text-muted':     '#666666',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}