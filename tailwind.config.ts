import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF7F2',
        bone: '#F5EFE6',
        beige: {
          DEFAULT: '#E8DDD0',
          dark: '#D4C4B0',
        },
        terra: {
          DEFAULT: '#C8573A',
          light: '#E8956D',
          dark: '#9B3E28',
        },
        gold: '#D4A84B',
        ink: {
          DEFAULT: '#1C1410',
          light: '#3D2B1F',
        },
        muted: '#8A7060',
        line: '#DDD0C0',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        sharp: 'cubic-bezier(0.55, 0, 0.1, 1)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        float: 'floatY 6s ease-in-out infinite',
        fadeUp: 'fadeUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
      },
    },
  },
  plugins: [],
};

export default config;
