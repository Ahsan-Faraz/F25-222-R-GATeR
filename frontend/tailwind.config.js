/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0E', // Dark baseline
        surface: 'rgba(255, 255, 255, 0.03)',
        primary: {
          DEFAULT: '#ffffff', // For major text
          faint: 'rgba(255, 255, 255, 0.5)',
        },
        accent: {
          DEFAULT: '#7C3AED', // violet-600
          light: '#A78BFA', // violet-400
          hover: '#6D28D9', // violet-700
          cyan: '#22D3EE',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Outfit', 'sans-serif', 'system-ui'],
      },
      boxShadow: {
        glow: '0 0 48px rgba(124, 58, 237, 0.2)',
        card: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(to right bottom, rgba(124, 58, 237, 0.15), rgba(34, 211, 238, 0.05))',
        'violet-cyan': 'linear-gradient(to right, #7C3AED, #22D3EE)',
      },
      animation: {
        'breathe': 'scale 4s ease-in-out infinite',
        'blob': 'blob 10s infinite',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scale: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.007)' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: .7 },
        }
      }
    },
  },
  plugins: [],
};
