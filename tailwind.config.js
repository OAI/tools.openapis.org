module.exports = {
  content: [
    'src/**/*.njk',
  ],
  safelist: [],
  theme: {
    fontFamily: {
      sans: ['Roboto', 'sans-serif'],
      serif: ['Merriweather', 'serif'],
    },
    extend: {
      colors: {
        change: 'transparent',
        lightgreen: '#94c73d',
      },
    },
  },
};
