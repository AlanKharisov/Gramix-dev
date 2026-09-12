import { copyFile, mkdir, writeFile } from 'node:fs/promises';

// Pages has no SPA rewrites. Serve the built entry point at each public route,
// so opening /main directly works without a 404 response or a hash URL.
for (const route of ['login', 'register', 'biometric', 'body-bio', 'main', 'stats', 'recommendations', 'history', 'profile', 'manual-entry']) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile('dist/index.html', `dist/${route}/index.html`);
}
await copyFile('dist/index.html', 'dist/404.html');
await writeFile('dist/.nojekyll', '');
