/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#1a1a1a',
        'bg-panel': '#151515',
        'border': '#2a2a2a',
        'text-primary': '#ffffff',
        'text-secondary': '#9ca3af',
        'text-muted': '#6b7280',
        'accent': '#8b5cf6',
        'accent-hover': '#7c3aed',
        'terminal-bg': '#0f0f0f',
        'terminal-fg': '#d4d4d4'
      }
    }
  },
  plugins: []
};
