import { defineConfig } from '@shined/lecp';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'cjs',
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
