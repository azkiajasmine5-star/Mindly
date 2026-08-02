/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#FCACD1',
          softPink: '#FFD9EF',
          blue: '#D6FCFF',
          yellow: '#F5F7CD',
          brown: '#907162',
          darkBg: '#0F0E13',
          darkCard: '#181622',
          lightBg: '#FAFAFD',
        }
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        premium: '0 8px 30px rgb(0, 0, 0, 0.04)',
        premiumDark: '0 8px 30px rgb(0, 0, 0, 0.4)',
        glass: '0 4px 30px rgba(0, 0, 0, 0.03)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
