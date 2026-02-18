import { build } from 'esbuild';
import { copyFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  // Build main.ts with esbuild
  await build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: 'dist/main.js',
    external: ['electron'],
    format: 'esm',
    sourcemap: true
  });

  // Copy preload.cjs
  await mkdir('dist', { recursive: true });
  await copyFile(
    join(__dirname, 'src', 'preload.cjs'),
    join(__dirname, 'dist', 'preload.cjs')
  );

  console.log('Build completed successfully');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
