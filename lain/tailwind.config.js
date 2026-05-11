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
        'accent-soft': '#a78bfa',
        'success': '#34d399',
        'warning': '#fbbf24',
        'danger': '#fb7185',
        'terminal-bg': '#0f0f0f',
        'terminal-fg': '#d4d4d4'
      },
      backdropBlur: {
        glass: '16px'
      },
      boxShadow: {
        glass: '0 8px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.04)',
        glow: '0 0 0 1px rgba(167,139,250,0.35), 0 4px 24px rgba(139,92,246,0.25)'
      }
    }
  },
  plugins: []
};
