/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      screens: {
        xs: '375px',
      },
      colors: {
        charcoal:  '#121212',
        surface:   '#1E1E1E',
        surface2:  '#2A2A2A',
        neon:      '#39FF14',
        gold:      '#D4AF37',
        goldLight: '#F0D060',
        danger:    '#FF4444',
        muted:     '#6B7280',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        amharic: ['Noto Sans Ethiopic', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        neon:  '0 0 12px #39FF14, 0 0 24px #39FF1440',
        gold:  '0 0 12px #D4AF37, 0 0 24px #D4AF3740',
        inner: 'inset 0 2px 8px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-neon':  'pulseNeon 1.5s ease-in-out infinite',
        'bounce-in':   'bounceIn 0.6s cubic-bezier(0.36,0.07,0.19,0.97)',
        'spin-slow':   'spin 3s linear infinite',
        'shimmer':     'shimmer 2.5s linear infinite',
        'float':       'float 3s ease-in-out infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%,100%': { boxShadow: '0 0 8px #39FF14' },
          '50%':     { boxShadow: '0 0 24px #39FF14, 0 0 48px #39FF1460' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.3)', opacity: '0' },
          '50%':  { transform: 'scale(1.1)' },
          '70%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
