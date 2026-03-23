/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Warm-tinted neutrals (Impeccable: never use pure gray, tint toward brand hue)
        surface: {
          50: '#faf9f7',   // warm off-white
          100: '#f3f1ed',
          200: '#e5e2db',
          300: '#d1cdc4',
          400: '#a8a298',
          500: '#7d776d',
          600: '#5c574f',
          700: '#43403a',
          800: '#2a2825',
          900: '#1a1917',
          950: '#0d0c0b',  // warm near-black (never pure #000)
        },
        accent: {
          DEFAULT: '#e07a2f', // warm amber — cinema marquee
          light: '#f0993f',
          dark: '#c46820',
          muted: '#b8885c',
        },
        ember: {
          DEFAULT: '#d4553a',
          light: '#e6735a',
        },
      },
      spacing: {
        // 4pt base grid (Impeccable: use 4pt, not 8pt)
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      fontSize: {
        // Fluid type scale (Impeccable: use clamp for headings)
        'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.25vw, 1rem)',
        'fluid-base': 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
        'fluid-lg': 'clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem)',
        'fluid-xl': 'clamp(1.5rem, 1.2rem + 1vw, 2.25rem)',
        'fluid-2xl': 'clamp(2rem, 1.5rem + 2vw, 3.5rem)',
        'fluid-3xl': 'clamp(2.5rem, 1.8rem + 3vw, 5rem)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
