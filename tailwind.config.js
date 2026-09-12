/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mackenzie: '#b1060e', // O vermelho oficial para mantermos a identidade visual
      }
    },
  },
  plugins: [],
}