// tailwind.config.js - The Night Market Coder Theme
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#8B6914',
        secondary: '#6B8E6B',
        accent: '#D4A843',
        background: '#F5F0E8',
        surface: '#FFFFFF',
        text: {
          DEFAULT: '#2D2926',
          muted: '#7A756E',
        },
        border: '#D9D4CC',
        warm: '#D4A843',
        cool: '#7BA3A8',
      },
      fontFamily: {
        heading: ["Space Grotesk", "Helvetica Neue", "sans-serif"],
        body: ["Source Sans 3", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'base': '0.25rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
      },
      transitionTimingFunction: {
        'default': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'snappy': 'cubic-bezier(0.25, 0.1, 0, 1)',
      },
      transitionDuration: {
        'fast': '100ms',
        'base': '200ms',
        'slow': '400ms',
      },
    },
  },
}