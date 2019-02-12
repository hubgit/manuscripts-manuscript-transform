module.exports = {
  env: {
    test: {
      plugins: [
        'transform-es2015-modules-commonjs',
      ],
    },
  },
  plugins: [
    '@babel/proposal-class-properties',
    '@babel/proposal-object-rest-spread',
  ],
  presets: [
    '@babel/preset-env',
    '@babel/preset-typescript',
  ],
}
