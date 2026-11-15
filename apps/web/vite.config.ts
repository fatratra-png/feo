import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer, defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Renders the legal pages to static HTML after the build (dist/privacy.html,
 * dist/terms.html, served at /privacy and /terms thanks to `cleanUrls`).
 * The SPA shell is empty until JavaScript runs, and Google's OAuth review
 * rejects a privacy policy it cannot read without it.
 */
function prerenderLegal(): Plugin {
  const pages = [
    { file: 'privacy.html', component: 'Privacy', title: 'Politique de confidentialité — FEO', description: 'Quelles données FEO collecte, pourquoi, avec qui elles sont partagées et comment les faire supprimer.' },
    { file: 'terms.html', component: 'Terms', title: "Conditions d'utilisation — FEO", description: "Les règles d'utilisation de FEO, le lecteur de musique avec une IA." },
  ];
  return {
    name: 'feo:prerender-legal',
    apply: 'build',
    async closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      const template = await readFile(path.join(dist, 'index.html'), 'utf8');
      const server = await createServer({
        configFile: false, plugins: [react()], appType: 'custom', logLevel: 'error',
        server: { middlewareMode: true },
        optimizeDeps: { noDiscovery: true, include: [] }, // one-off render: no dependency pre-bundling
      });
      try {
        // React itself is loaded by Node (Vite externalises it for SSR, so the page shares this copy).
        const { renderToStaticMarkup } = await import('react-dom/server');
        const { createElement } = await import('react');
        const legal = await server.ssrLoadModule(path.resolve(__dirname, 'src/pages/Legal.tsx'));
        for (const page of pages) {
          const body = renderToStaticMarkup(createElement(legal[page.component]));
          if (body.length < 2000) throw new Error(`prerendered ${page.file} looks empty`);
          const html = template
            .replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
            .replace(/(<meta name="description" content=")[^"]*(")/, `$1${page.description}$2`)
            .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
          await writeFile(path.join(dist, page.file), html);
        }
      } finally {
        await server.close();
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), prerenderLegal()],
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than the app: separate files stay cached across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (id.includes('react-router')) return 'router';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});