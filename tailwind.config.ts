import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#101114',
          800: '#1D2127',
        },
        slate: {
          700: '#35556D',
        },
        canvas: {
          '000': '#FFFFFF',
          '050': '#F8F7F3',
        },
        sand: {
          100: '#F0ECE4',
          300: '#D9D1C3',
        },
        stone: {
          500: '#7A7368',
        },
        success: {
          50: '#ECFDF5',
          200: '#A7F3D0',
          700: '#166534',
        },
        warning: {
          50: '#FFFBEB',
          200: '#FDE68A',
          700: '#9A6700',
        },
        error: {
          50: '#FEF2F2',
          200: '#FECACA',
          700: '#B42318',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['56px', { lineHeight: '60px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg': ['44px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'title-xl': ['32px', { lineHeight: '38px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-lg': ['24px', { lineHeight: '30px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'meta-xs': ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '18px',
        pill: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(16, 17, 20, 0.04)',
        sm: '0 2px 6px rgba(16, 17, 20, 0.06), 0 1px 2px rgba(16, 17, 20, 0.04)',
        md: '0 6px 16px rgba(16, 17, 20, 0.08), 0 2px 4px rgba(16, 17, 20, 0.04)',
        lg: '0 16px 32px rgba(16, 17, 20, 0.10), 0 4px 8px rgba(16, 17, 20, 0.06)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '240ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      maxWidth: {
        'container-md': '768px',
        'container-lg': '1120px',
        'container-xl': '1240px',
        'container-2xl': '1360px',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
