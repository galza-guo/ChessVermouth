/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Refined Tactility Design System
        'rt-bg': '#0D0D12',
        'rt-surface': '#1A1A24',
        'rt-surface-alt': '#252532',
        'rt-gold': '#C9A227',
        'rt-gold-light': '#D4AD2E',
        'rt-gold-dark': '#B8922A',
        'rt-sapphire': '#3D5A80',
        'rt-success': '#2E7D5A',
        'rt-error': '#A63D40',
        'rt-warning': '#D4883A',
        'rt-text': '#EAEAF0',
        'rt-text-secondary': '#A0A0B0',
        'rt-text-muted': '#6B6B7A',
      },
      boxShadow: {
        'floating-low': '0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15)',
        'floating-high': '0 16px 48px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
