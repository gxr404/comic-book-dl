import path from 'node:path'

export default {
  test: {
    globals: true,
    testTimeout: 900000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/temp/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
}