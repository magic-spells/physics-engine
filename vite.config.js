import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The ESM build externalizes @magic-spells/event-emitter so npm dedupes it to a
// single copy in projects that also pull in animation-engine, frame-engine, etc.
// The UMD build stays self-contained for script-tag use, where there is no npm
// to dedupe with. Vite applies `external` per build, so the two formats are
// built in separate passes keyed off BUILD_FORMAT.
const format = process.env.BUILD_FORMAT || 'es';

const config = {
  build: {
    lib: {
      entry: resolve(__dirname, 'src/physics-engine.js'),
      name: 'PhysicsEngine',
      formats: [format],
      fileName: () => (format === 'es' ? 'physics-engine.esm.js' : 'physics-engine.min.js'),
    },
    outDir: 'dist',
    // Only the first pass clears dist, or it would delete the other format.
    emptyOutDir: format === 'es',
    copyPublicDir: false,
  },
  server: {
    port: 3008,
    open: '/demo/index.html',
  },
  plugins: [
    {
      name: 'copy-types',
      closeBundle() {
        copyFileSync('src/physics-engine.d.ts', 'dist/physics-engine.d.ts');
      },
    },
  ],
};

if (format === 'es') {
  config.build.rollupOptions = {
    external: ['@magic-spells/event-emitter'],
  };
}

export default config;
