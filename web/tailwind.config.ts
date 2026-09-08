import type { Config } from "tailwindcss";

// پالت از روی طراحی مرجع: کهربایی روی کرم، با متن سرمه‌ای تیره.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FEF7EA",
          100: "#FDEBC9",
          200: "#FADCA0",
          300: "#F7C866",
          400: "#F4B444",
          500: "#F0A828", // کهربایی اصلی
          600: "#D68A12",
          700: "#A96A0E",
        },
        ink: {
          DEFAULT: "#1E2A47", // سرمه‌ای تیره (دکمه‌های ثانویه، عنوان‌ها)
          soft: "#42506F",
          muted: "#7A849B",
        },
        canvas: {
          DEFAULT: "#FAF7F2", // کرم پس‌زمینه
          alt: "#F3EEE5",
        },
      },
      fontFamily: {
        sans: ["var(--font-vazir)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,42,71,.04), 0 8px 24px rgba(30,42,71,.06)",
        lift: "0 4px 8px rgba(30,42,71,.06), 0 16px 40px rgba(30,42,71,.10)",
      },
    },
  },
  plugins: [],
};
export default config;
