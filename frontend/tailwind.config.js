/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep Focus theme — navy-charcoal base, scientifically backed for sustained concentration
        focus: {
          bg: "#0f1419",
          "bg-alt": "#151b23",
          surface: "#1c2433",
          "surface-alt": "#232d3f",
          border: "#2a3444",
          "border-light": "#354258",
          text: "#e2e0d8",
          "text-muted": "#9ca3af",
          "text-dim": "#6b7280",
          teal: "#4a9a8e",
          "teal-light": "#5cb8aa",
          "teal-dim": "#2d6b62",
          amber: "#d4a574",
          "amber-light": "#e8c49a",
          "amber-dim": "#8a6a42",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
