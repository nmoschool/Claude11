import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-tajawal)", "Tahoma", "Arial", "sans-serif"],
      },
      colors: {
        // gray-400 الافتراضي (#9ca3af) تباينه 2.5:1 على الأبيض — دون WCAG AA؛ نرفعه لدرجة 500
        gray: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#6b7280", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827" },
        brand: {
          50: "#f6f3ff",
          100: "#ede8ff",
          200: "#ddd3ff",
          300: "#c4b2fe",
          400: "#a786fb",
          500: "#8b5cf6",
          600: "#7440e6",
          700: "#6230c9",
          800: "#5029a3",
          900: "#432584",
        },
        accent: {
          50: "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
          800: "#9d174d",
          900: "#831843",
        },
        mint: {
          50: "#effefb",
          100: "#c8fff4",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
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
