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
        primary: {
          DEFAULT: '#2c3639',
          light: '#3f4e4f',
        },
        secondary: {
          DEFAULT: '#3f4e4f',
        },
        accent: {
          DEFAULT: '#a27b5c',
          light: '#b89176',
        },
        light: {
          DEFAULT: '#dcd7c9',
        },
        success: '#4ade80',
        warning: '#fbbf24',
        error: '#ef4444',
        info: '#3b82f6',
      },
      boxShadow: {
        card: '0 10px 25px rgba(44, 54, 57, 0.15)',
        'card-hover': '0 15px 35px rgba(44, 54, 57, 0.25)',
      },
    },
  },
  plugins: [],
};
