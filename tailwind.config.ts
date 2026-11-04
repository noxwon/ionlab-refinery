import type { Config } from "tailwindcss";

const pretendardStack = [
  '"Pretendard Variable"',
  "Pretendard",
  "-apple-system",
  "BlinkMacSystemFont",
  "system-ui",
  "Roboto",
  '"Helvetica Neue"',
  '"Segoe UI"',
  '"Apple SD Gothic Neo"',
  '"Noto Sans KR"',
  '"Malgun Gothic"',
  "sans-serif",
];

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: pretendardStack,
        mono: pretendardStack,
      },
    },
  },
  plugins: [],
};

export default config;
