/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(129,140,248,0.2), 0 20px 50px rgba(59,130,246,0.18)',
      },
    },
  },
  plugins: [],
};
