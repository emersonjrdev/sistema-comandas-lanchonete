/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        amber: {
          // Paleta baseada na logo da Padaria Grande Familia
          50: '#fdf9f1',
          100: '#f8edd6',
          200: '#f1d7a5',
          300: '#e5bb72',
          400: '#d39a4d',
          500: '#bc7d35',
          600: '#995f29',
          700: '#764620',
          800: '#5a3219',
          900: '#3f2312',
        },
        brand: {
          cream: '#fdf9f1',
          gold: '#d39a4d',
          wheat: '#e5bb72',
          brown: '#5a3219',
          dark: '#3f2312',
        },
      },
    },
  },
  plugins: [],
}
