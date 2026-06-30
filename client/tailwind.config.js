/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-base':    '#141414', // Pure Netflix dark background
        'dark-surface': '#181818', // Slightly elevated surface
        'dark-border':  '#2a2a2a',
        'dark-hover':   '#333333',
        'brand':        '#E50914', // Netflix Red
        'brand-light':  '#F40612', // Light Red
        'brand-dark':   '#B81D24', // Dark Red
        'text-primary':   '#E5E5E5', // Netflix primary text color
        'text-secondary': '#B3B3B3',
        'text-muted':     '#808080',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}