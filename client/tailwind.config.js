/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-base':    '#0e0e10',
        'dark-surface': '#18181b',
        'dark-border':  '#2a2a2d',
        'dark-hover':   '#3a3a3d',
        'brand':        '#9147ff',
        'brand-light':  '#a970ff',
        'brand-dark':   '#772ce8',
        'text-primary':   '#efeff1',
        'text-secondary': '#adadb8',
        'text-muted':     '#53535f',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}