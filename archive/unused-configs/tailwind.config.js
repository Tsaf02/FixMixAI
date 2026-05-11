/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          white: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.10)',
          strong: 'rgba(255, 255, 255, 0.12)'
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glass-lg': '0 25px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.12)'
      }
    }
  },
  plugins: []
}
