import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-tajawal)", "Tahoma", "Arial", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eefbf3",
          100: "#d6f5e1",
          200: "#aeebc7",
          300: "#7bdba7",
          400: "#48c586",
          500: "#22a76a",
          600: "#158756",
          700: "#126b47",
          800: "#12553a",
          900: "#104631",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f2760c",
          600: "#e35d07",
          700: "#bc4409",
          800: "#95370f",
          900: "#792f10",
        },
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
