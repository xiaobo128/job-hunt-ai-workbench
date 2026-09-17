import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        panel: "#f8fafc",
        line: "#e5e7eb",
        accent: "#0f766e",
        accentSoft: "#ecfdf5",
        warn: "#b45309",
        danger: "#b91c1c"
      },
      boxShadow: {
        card: "0 1px 2px rgba(17, 24, 39, 0.03)"
      }
    }
  },
  plugins: []
};

export default config;
