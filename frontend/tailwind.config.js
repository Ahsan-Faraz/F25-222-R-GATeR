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
        // Minimalist-Futurism Palette - Neutral Scale
        bg: {
          DEFAULT: '#000000',      // True Black
          zinc: '#09090b',         // Deep Zinc (zinc-950)
          elevated: '#0a0a0a',     // Slightly elevated surface
        },
        surface: {
          DEFAULT: '#09090b',      // Deep Zinc
          hover: '#18181b',        // zinc-900
          active: '#27272a',       // zinc-800
        },
        border: {
          DEFAULT: '#27272a',      // zinc-800 - structural lines
          subtle: '#1f1f23',       // Subtler border
          hover: '#3f3f46',        // zinc-700 - hover state
        },
        text: {
          primary: '#fafafa',      // zinc-50 - titles
          secondary: '#a1a1aa',    // zinc-400 - metadata/labels
          muted: '#71717a',        // zinc-500 - tertiary
          faint: '#52525b',        // zinc-600 - very subtle
        },
        accent: {
          DEFAULT: '#3b82f6',      // Blue-500 - primary action
          hover: '#2563eb',        // Blue-600
          subtle: 'rgba(59, 130, 246, 0.1)', // Subtle accent bg
        },
        // Status colors
        success: '#22c55e',        // green-500
        warning: '#f59e0b',        // amber-500
        error: '#ef4444',          // red-500
        info: '#3b82f6',           // blue-500
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display': ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        'sidebar': '240px',
      },
      borderRadius: {
        'subtle': '6px',
        'card': '8px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        skeleton: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
