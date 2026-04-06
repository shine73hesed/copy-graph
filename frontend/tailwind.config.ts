import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1a1a1a', 2: '#555', 3: '#999', 4: '#c4c4c4' },
        paper: { DEFAULT: '#fbfaf8', 2: '#f4f2ef' },
        cream: '#edeae4',
        accent: { DEFAULT: '#c0582e', light: '#f8f0eb' },
        teal: { DEFAULT: '#14b8a6', bg: '#ecfdf5' },
        primary: { DEFAULT: '#ec5b13', light: '#fff4ed' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
