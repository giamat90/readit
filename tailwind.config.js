/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary:   "#4F46E5",
        secondary: "#818CF8",
        paper:     "#FAF7F0",
        ink:       "#1E1E2E",
        muted:     "#6B7280",
        danger:    "#D32F2F",
        warning:   "#F57C00",
        success:   "#2E7D32",
      },
    },
  },
  plugins: [],
};
