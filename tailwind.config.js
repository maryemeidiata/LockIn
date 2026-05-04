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
        sans: ['"DM Sans"', 'sans-serif'],
        serif: ['"DM Serif Display"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(26,10,16,0.06)',
      },
    },
  },
  plugins: [],
}

