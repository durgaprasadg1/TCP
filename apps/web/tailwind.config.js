/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#EBE2CC',
          900: '#EBE2CC',
          850: '#F3EDDF',
          800: '#DED6C1',
          700: '#CFC6B1',
          600: '#B7B09E',
          500: '#8E8777',
        },
        slate: {
          50: '#302d26', 100: '#302d26', 200: '#38342c', 300: '#514b40', 400: '#514b40',
          500: '#6a6356', 600: '#827b6d', 700: '#B7B09E', 800: '#DED6C1', 900: '#F3EDDF', 950: '#FBF8F0',
        },
        accent: { DEFAULT: '#514b40', soft: '#DED6C1' },
        ok: { DEFAULT: '#356448', soft: '#DCE8D9' },
        bad: { DEFAULT: '#9B3939', soft: '#F3DEDA' },
        warn: { DEFAULT: '#87611D', soft: '#F2E7C8' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
