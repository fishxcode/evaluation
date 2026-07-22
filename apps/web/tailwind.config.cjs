/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        canvas: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      boxShadow: {
        panel:
          "0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
