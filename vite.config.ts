import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

/**
 * Injeta `<meta name="app-version" content="X.Y.Z">` no index.html em
 * build/serve time, lendo APP_VERSION direto de src/lib/version.ts.
 *
 * Como index.html é servido com NetworkFirst (workbox) e Cache-Control
 * no-cache (Cloudflare Worker), essa meta tag sempre reflete o deploy
 * mais recente — mesmo quando o bundle JS no SW está preso na versão
 * antiga. Usada pelo heartbeat de versão em src/lib/version.ts para
 * quebrar o deadlock de cache.
 *
 * Aditivo e seguro: só adiciona uma meta tag. Falha de leitura cai para
 * "unknown" sem quebrar o build.
 */
function appVersionMetaPlugin(): Plugin {
  let cachedVersion: string | null = null;
  const readVersion = (): string => {
    if (cachedVersion) return cachedVersion;
    try {
      const file = readFileSync(
        path.resolve(__dirname, "src/lib/version.ts"),
        "utf8",
      );
      const m = file.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      cachedVersion = m ? m[1] : "unknown";
    } catch {
      cachedVersion = "unknown";
    }
    return cachedVersion;
  };
  return {
    name: "app-version-meta",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const v = readVersion();
        const tag = `<meta name="app-version" content="${v}">`;
        if (html.includes('name="app-version"')) return html;
        return html.replace(/<\/head>/i, `  ${tag}\n  </head>`);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    appVersionMetaPlugin(),
    mcpPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'robots.txt', '**/*.png'],
      manifest: {
        name: 'Sistema de Gestão Huggs',
        short_name: 'Huggs',
        description: 'Sistema de Gestão Integrada de Negócios',
        theme_color: '#1a1a1a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // index.html FORA do precache: deve sempre ir à rede para detectar deploys novos.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/~oauth/],
        cleanupOutdatedCaches: true,
        // skipWaiting + clientsClaim: novo SW assume controle imediatamente após
        // ativar (sem precisar fechar todas as abas). Combinado com o listener
        // de `controllerchange` em PWAContext, garante reload automático para
        // a versão nova em até ~2 minutos após o deploy.
        skipWaiting: true,
        clientsClaim: true,
        // Adiciona handlers de Web Push (push + notificationclick) ao SW gerado.
        importScripts: ['/push-handler.js'],
        runtimeCaching: [
          // Navegação SPA: NetworkFirst para HTML — assim o cliente sempre
          // tenta puxar o index.html novo (com hashes de bundle atualizados);
          // só cai no cache se estiver offline.
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-navigation',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query', '@supabase/supabase-js'],
  },
  build: {
    sourcemap: mode === 'development' ? true : 'hidden',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Estratégia conservadora: apenas agrupamos vendors GRANDES e
          // SEM dependências cruzadas. Agrupar libs heterogêneas (cmdk,
          // sonner, zod, react-hook-form etc) num mesmo chunk causa
          // dependências circulares com TDZ ("Cannot access 'X' before
          // initialization") no bundle minificado. Deixe o Rollup decidir
          // os demais — ele resolve a ordem corretamente.
          if (!id.includes('node_modules')) return undefined;

          // React + runtime deps internas precisam estar no MESMO chunk.
          if (id.match(/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|use-sync-external-store|react-is|@remix-run[\\/]router)[\\/]/)) {
            return 'react-vendor';
          }
          if (id.includes('@supabase')) return 'supabase-vendor';
          if (id.includes('@tanstack')) return 'tanstack-vendor';
          if (id.includes('@radix-ui')) return 'radix-vendor';
          if (id.match(/[\\/]node_modules[\\/](recharts|d3-[^\\/]+)[\\/]/)) return 'charts-vendor';
          if (id.match(/[\\/]node_modules[\\/](jspdf|pdfjs-dist|pptxgenjs|exceljs|jszip|file-saver)[\\/]/)) return 'docs-vendor';
          if (id.includes('mapbox-gl') || id.includes('@vis.gl/react-google-maps') || id.includes('@googlemaps')) return 'maps-vendor';
          // Demais node_modules: chunk único default (Rollup ordena).
          return undefined;
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || 'asset';
          const info = name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(name)) {
            return `assets/images/[name]-[hash].${ext}`;
          }
          if (/\.(woff|woff2|ttf|eot)$/i.test(name)) {
            return `assets/fonts/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    chunkSizeWarningLimit: 1000,
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
  },
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    },
  },
}));
