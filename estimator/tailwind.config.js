/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7f4",
          100: "#d9ece3",
          500: "#2f7d5b",
          600: "#256649",
          700: "#1e523b",
        },
      },
    },
  },
  plugins: [],
}
