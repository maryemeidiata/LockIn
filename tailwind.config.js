/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        burg: '#6B1E3A',
        'burg-light': '#8B2A4E',
        'burg-deep': '#4A1228',
        'burg-muted': '#C4738A',
        cream: '#FAF6F1',
        cream2: '#F2EAE0',
        cream3: '#E8DDD0',
        text: '#1A0A10',
        text2: '#5C3347',
        text3: '#9A6B7A',
        border: '#DDD0C8',
      },
      fontFamily: {
        sans: ['"Urbanist"', 'sans-serif'],
        serif: ['"DM Serif Display"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 4px rgba(26,10,16,0.07), 0 1px 2px rgba(26,10,16,0.04)',
        'card-md': '0 4px 16px rgba(26,10,16,0.09), 0 1px 4px rgba(26,10,16,0.05)',
        'card-hover': '0 8px 28px rgba(26,10,16,0.12), 0 2px 6px rgba(26,10,16,0.06)',
      },
    },
  },
  plugins: [],
}

