/** @type {import('tailwindcss').Config} */
// AssetFlow design tokens — "operations ledger" language.
// Warm paper neutrals + a single deep cobalt accent (validated dataviz ramp).
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm ink neutrals (replaces cool slate chrome)
        ink: {
          950: '#0f0e0c',
          900: '#191713',
          800: '#2a2723',
          700: '#3a3833',
          600: '#55534e',
          500: '#6f6c65',
          400: '#8a8880',
          300: '#b5b2a9',
          200: '#d6d4cc',
          100: '#eae8e1',
          50: '#f6f5f1',
        },
        // Deep cobalt accent — steps taken from the validated sequential ramp
        accent: {
          50: '#f0f5fc',
          100: '#dfeafa',
          200: '#b7d3f6',
          300: '#86b6ef',
          400: '#3987e5',
          500: '#256abf',
          600: '#1c5cab',
          700: '#184f95',
          800: '#104281',
          900: '#0d366b',
        },
        // `brand` kept as an alias of accent so legacy classes stay coherent
        brand: {
          50: '#f0f5fc',
          100: '#dfeafa',
          200: '#b7d3f6',
          300: '#86b6ef',
          400: '#3987e5',
          500: '#256abf',
          600: '#1c5cab',
          700: '#184f95',
          800: '#104281',
          900: '#0d366b',
          950: '#0a2a54',
        },
        danger: {
          50: '#fef3f2',
          100: '#fee4e2',
          600: '#b42318',
          700: '#912018',
        },
        surface: {
          DEFAULT: '#fcfcfb',
          muted: '#f6f5f1',
          border: '#e5e3db',
        },
        paper: '#f3f2ee',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(19, 18, 17, 0.03)',
        overlay: '0 16px 40px -12px rgba(19, 18, 17, 0.22), 0 4px 12px -4px rgba(19, 18, 17, 0.08)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(3px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.985)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.12s ease-out',
      },
    },
  },
  plugins: [],
};
