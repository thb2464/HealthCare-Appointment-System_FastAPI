/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "sans-serif"],
      },
      colors: {
        navy: {
          950: "#ffffff",
          900: "#f8fafb",
          800: "#ffffff",
          700: "#f1f5f9",
          600: "#e2e8f0",
        },
        teal: {
          300: "#6ee7b7",
          400: "#10b981",
          500: "#059669",
          600: "#047857",
        },
        slate: {
          850: "#f1f5f9",
        },
      },
      boxShadow: {
        glow: "0 4px 16px rgba(5,150,105,0.12)",
        "glow-sm": "0 2px 8px rgba(5,150,105,0.10)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        "slide-down": "slideDown 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { opacity: 0, transform: "translateY(16px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: 0, transform: "translateY(-8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: 0, transform: "scale(0.95)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
