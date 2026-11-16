/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terran: {
          light: '#38bdf8',
          DEFAULT: '#0284c7',
          dark: '#0369a1',
        },
        zerg: {
          light: '#c084fc',
          DEFAULT: '#9333ea',
          dark: '#581c87',
        },
        protoss: {
          light: '#fde047',
          DEFAULT: '#eab308',
          dark: '#854d0e',
        },
        sci: {
          dark: '#060a12',
          panel: '#0d1527',
          panelBorder: '#1e293b',
          glow: '#00f0ff',
        }
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
        display: ['Rajdhani', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
};
