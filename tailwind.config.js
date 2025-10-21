/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Here we redefine the color palette for a dark theme.
        // The old 'aida-light' (light background) becomes a dark background.
        // The old 'aida-dark' (dark text) becomes a light text.
        'aida-light': '#111827',         // Main dark background (was light)
        'aida-dark': '#E5E7EB',          // Main light text color (was dark)
        'aida-pink': '#FF5F90',          // Accent color
        'aida-pink-hover': '#e55a5a',    // Accent color on hover

        // New semantic colors for our dark theme
        'aida-card': '#1F2937',          // Background for cards, headers, modals
        'aida-border': '#374151',        // Border color
        'aida-text-muted': '#9CA3AF',    // Muted text color for descriptions
      },
    },
  },
  plugins: [],
}