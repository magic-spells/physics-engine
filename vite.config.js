import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  build: {
    lib: {
      entry: resolve(__dirname, 'src/physics-engine.js'),
      name: 'PhysicsEngine',
      formats: ['umd', 'es'],
      fileName: (format) => format === 'es' ? 'physics-engine.esm.js' : 'physics-engine.min.js',
    },
    outDir: 'dist',
    esbuild: {
      keepNames: true,
    },
    copyPublicDir: false,
  },
  server: {
    port: 3008,
    open: '/demo/index.html',
  },
};
