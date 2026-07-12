/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd3ff',
          300: '#8eb6ff',
          400: '#598cff',
          500: '#3563ff',
          600: '#1f42f5',
          700: '#1731e1',
          800: '#1a2bb6',
          900: '#1c2b8f',
          950: '#151a57',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f8fc',
          border: '#e6eaf2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16, 24, 40, 0.04), 0 1px 3px 0 rgba(16, 24, 40, 0.08)',
        cardhover: '0 4px 12px -2px rgba(16, 24, 40, 0.10), 0 2px 6px -2px rgba(16, 24, 40, 0.06)',
        pop: '0 12px 32px -8px rgba(16, 24, 40, 0.18)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.16s ease-out',
      },
    },
  },
  plugins: [],
};
