/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
      "./public/index.html"
    ],
    theme: {
      extend: {
        fontFamily: {
          'sans': ['Inter', 'ui-sans-serif', 'system-ui'],
        },
        colors: {
          // Brand colors from Code Blossom brand book
          brand: {
            coral: '#FF5F90',
            'coral-dark': '#FF5F90',
            gray: '#E0E0E0',
            dark: '#333333',
          },
          // Custom red shades for consistency
          red: {
            50: '#fef2f2',
            100: '#fee2e2',
            200: '#fecaca',
            300: '#fca5a5',
            400: '#f87171',
            500: '#FF69B4', // Brand coral
            600: '#FF69B4', // Brand coral dark
            700: '#d44646',
            800: '#b91c1c',
            900: '#991b1b',
          }
        },
        animation: {
          'bounce-slow': 'bounce 2s infinite',
          'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'float': 'float 3s ease-in-out infinite',
        },
        keyframes: {
          float: {
            '0%, 100%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(-10px)' },
          }
        },
        boxShadow: {
          'coral': '0 4px 14px 0 rgba(255, 107, 107, 0.3)',
          'coral-lg': '0 10px 25px -3px rgba(255, 107, 107, 0.3)',
        },
        backgroundImage: {
          'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
          'gradient-coral': 'linear-gradient(135deg, #FF6B6B, #e55a5a)',
        }
      },
    },
    plugins: [
      require('@tailwindcss/forms'),
      require('@tailwindcss/typography'),
    ],
    plugins: [
    require('tailwindcss-rtl'),
  ],
  }