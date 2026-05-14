/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // These now point to the CSS variables in index.css
        // so they can dynamically switch between light and dark
        'aida-light': 'var(--color-aida-light)',
        'aida-dark': 'var(--color-aida-dark)',
        'aida-card': 'var(--color-aida-card)',
        'aida-border': 'var(--color-aida-border)',
        'aida-text-muted': 'var(--color-aida-text-muted)',
        'aida-border-subtle': 'var(--color-border-subtle)',
        
        // Pink stays the same in both modes
        'aida-pink': '#FF5F90',          
        'aida-pink-hover': '#e55a5a',
      },
    },
  },
  plugins: [],
}