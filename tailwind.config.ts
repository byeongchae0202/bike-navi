import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dashboard: '#05070d',
        panel: '#0c1020',
        accent: '#3b82f6',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config
