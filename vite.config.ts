import path from 'path';
import fs from 'fs';
import os from 'os';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Custom plugin: resolve bare imports that only exist in the import-map (production)
 * to their esm.sh CDN URLs during dev mode — avoids npm install.
 */
function cdnExternals(map: Record<string, string>): Plugin {
  return {
    name: 'cdn-externals',
    enforce: 'pre',
    resolveId(source) {
      if (map[source]) return { id: map[source], external: true };
      return null;
    },
  };
}

/**
 * Dev/preview endpoint exposing Google key from OpenCode auth store at runtime.
 * This avoids requiring a rebuild whenever auth.json changes.
 */
function localAuthKeyEndpoint(): Plugin {
  const handler = (req: any, res: any, next: any) => {
    const rawUrl = req?.url || '';
    const url = new URL(rawUrl, 'http://localhost');
    if (url.pathname !== '/api/local-auth/google-key') {
      next();
      return;
    }

    const { geminiKey } = readAuthKeys();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ key: geminiKey || '' }));
  };

  return {
    name: 'paperstudio-local-auth-key-endpoint',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// All bare imports that are NOT in node_modules — resolved via esm.sh CDN in dev mode
// (In production, the import-map in index.html handles these)
const CDN_MAP: Record<string, string> = {
  'marked': 'https://esm.sh/marked@15',
  'dompurify': 'https://esm.sh/dompurify@3',
  'morphdom': 'https://esm.sh/morphdom@2',
  'diff': 'https://esm.sh/diff@7',
  '@codemirror/view': 'https://esm.sh/@codemirror/view@6',
  '@codemirror/state': 'https://esm.sh/@codemirror/state@6',
  '@codemirror/language': 'https://esm.sh/@codemirror/language@6',
  '@codemirror/commands': 'https://esm.sh/@codemirror/commands@6',
  '@codemirror/search': 'https://esm.sh/@codemirror/search@6',
  '@codemirror/autocomplete': 'https://esm.sh/@codemirror/autocomplete@6',
  '@codemirror/lang-css': 'https://esm.sh/@codemirror/lang-css@6',
  '@codemirror/legacy-modes/mode/stex': 'https://esm.sh/@codemirror/legacy-modes@6/mode/stex',
  '@codemirror/legacy-modes/mode/python': 'https://esm.sh/@codemirror/legacy-modes@6/mode/python',
  '@lezer/highlight': 'https://esm.sh/@lezer/highlight@1',
};

/**
 * Read API keys from OpenCode's auth store (~/.local/share/opencode/auth.json).
 * If a key is missing, a warning is printed — log in via OpenCode Settings → Providers.
 */
function readAuthKeys() {
  const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
  try {
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const anthropicKey: string = auth?.anthropic?.access || '';
    const openaiKey: string = auth?.openai?.access || '';
    const geminiKey: string = auth?.google?.key || '';
    if (!anthropicKey) console.warn('[PaperStudio] Anthropic key missing — log in at OpenCode Settings → Providers');
    if (!openaiKey)    console.warn('[PaperStudio] OpenAI key missing — log in at OpenCode Settings → Providers');
    if (!geminiKey)    console.warn('[PaperStudio] Google/Gemini key missing — log in at OpenCode Settings → Providers');
    return { anthropicKey, openaiKey, geminiKey };
  } catch {
    console.warn(`[PaperStudio] Could not read ${authPath} — please log in via OpenCode Settings → Providers`);
    return { anthropicKey: '', openaiKey: '', geminiKey: '' };
  }
}

export default defineConfig(() => {
    const { anthropicKey, openaiKey, geminiKey } = readAuthKeys();
    return {
      server: {
        port: 3000,
        strictPort: false, // Allow fallback to another port if 3000 is busy
        host: '0.0.0.0',
        proxy: {
          '/api/anthropic': {
            target: 'https://api.anthropic.com',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api\/anthropic/, ''),
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
          },
          '/api/openai': {
            target: 'https://api.openai.com',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api\/openai/, ''),
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
            },
          },
          // Universal webfetch proxy — allows browser to fetch any URL via /api/fetch?url=...
          // Bypasses CORS restrictions for paper pages, documentation, etc.
          '/api/fetch': {
            target: 'http://localhost', // dummy, overridden by configure()
            changeOrigin: true,
            configure: (proxy: any) => {
              proxy.on('proxyReq', (_proxyReq: any, req: any, res: any) => {
                // Intercept and redirect to the actual target URL
                const url = new URL(req.url, 'http://localhost');
                const targetUrl = url.searchParams.get('url');
                if (!targetUrl) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
                  return;
                }
              });
            },
            // Use a custom bypass to handle the actual proxying
            bypass: (req: any, res: any) => {
              const urlParam = new URL(req.url, 'http://localhost').searchParams.get('url');
              if (!urlParam) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
                return false;
              }
              // Fetch the target URL server-side and pipe the response
              import('node:https').then(https => import('node:http').then(http => {
                const mod = urlParam.startsWith('https') ? https : http;
                const fetchReq = mod.get(urlParam, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PaperStudio/1.0; Academic Research Tool)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  }
                }, (fetchRes: any) => {
                  // Follow redirects (up to 3)
                  if ([301, 302, 303, 307, 308].includes(fetchRes.statusCode) && fetchRes.headers.location) {
                    const redirect = fetchRes.headers.location;
                    const rMod = redirect.startsWith('https') ? https : http;
                    rMod.get(redirect, {
                      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PaperStudio/1.0)' }
                    }, (rRes: any) => {
                      res.writeHead(rRes.statusCode, {
                        'Content-Type': rRes.headers['content-type'] || 'text/html',
                        'Access-Control-Allow-Origin': '*',
                      });
                      rRes.pipe(res);
                    }).on('error', () => {
                      res.writeHead(502, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ error: 'Redirect fetch failed' }));
                    });
                    return;
                  }
                  res.writeHead(fetchRes.statusCode, {
                    'Content-Type': fetchRes.headers['content-type'] || 'text/html',
                    'Access-Control-Allow-Origin': '*',
                  });
                  fetchRes.pipe(res);
                });
                fetchReq.on('error', (err: any) => {
                  res.writeHead(502, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Fetch failed: ${err.message}` }));
                });
              }));
              return false; // Don't pass to proxy — we handled it
            },
          },
        },
      },
      plugins: [localAuthKeyEndpoint(), cdnExternals(CDN_MAP), react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        'process.env.GOOGLE_GENERATIVE_AI_API_KEY': JSON.stringify(geminiKey),
        'process.env.ANTHROPIC_API_KEY': JSON.stringify(anthropicKey),
        'process.env.OPEN_AI_KEY': JSON.stringify(openaiKey),
      },
      build: {
        rollupOptions: {
          external: [
            '@codemirror/view',
            '@codemirror/state',
            '@codemirror/language',
            '@codemirror/commands',
            '@codemirror/search',
            '@codemirror/autocomplete',
            '@codemirror/lang-css',
            '@codemirror/legacy-modes/mode/stex',
            '@codemirror/legacy-modes/mode/python',
            '@lezer/highlight',
            'marked',
            'dompurify',
            'morphdom',
            'diff',
          ],
        },
      },
      assetsInclude: ['**/*.keep'],
      optimizeDeps: {
        esbuildOptions: {
          loader: {
            '.keep': 'text'
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
