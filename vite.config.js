import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-index-html',
      closeBundle() {
        // Ensure build directory exists
        const buildDir = path.resolve(__dirname, 'build');
        if (!existsSync(buildDir)) {
          mkdirSync(buildDir, { recursive: true });
        }
        
        // Copy index.html to build directory
        copyFileSync(
          path.resolve(__dirname, 'index.html'),
          path.resolve(buildDir, 'index.html')
        );
        console.log('✓ Copied index.html to build directory');
      }
    }
  ],
  build: {
    outDir: 'build',
    lib: {
      entry: path.resolve(__dirname, 'src/main.jsx'),
      name: 'AidaWidget',
      fileName: (format) => `aida-widget.${format}.js`,
      formats: ['umd'],
    },
    minify: false,
  },
});