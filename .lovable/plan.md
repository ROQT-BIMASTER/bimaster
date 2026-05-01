## Diagnóstico (confirmado)

A tela branca em `https://bimaster.online` (e também em `bimaster.lovable.app`) **não é problema de DNS, IONOS, Cloudflare ou domínio**. O DNS está correto: o domínio resolve para `185.158.133.1`, o servidor responde HTTP 200 com o HTML do app, e o título "Sistema de Gestão Huggs" é entregue normalmente.

O problema é **um erro de JavaScript em runtime na versão publicada**, capturado pelo console do navegador:

```
TypeError: Cannot read properties of undefined (reading 'forwardRef')
    at radix-vendor-Hqrkfrmo.js
```

Isso significa: o bundle que contém os componentes Radix UI (base de toda a UI do shadcn) tenta executar `React.forwardRef(...)` no momento em que carrega, mas o módulo `react` que ele importa ainda está `undefined`. Sem nenhum componente Radix funcionando, **nenhuma tela renderiza** — daí o branco total.

### Por que só acontece em produção
O preview usa o dev server do Vite, que carrega módulos individualmente em ordem natural — o React sempre está pronto antes do Radix. Em produção, o build do Vite agrupa o código em "chunks" e a ordem de execução é definida pelo `manualChunks` em `vite.config.ts`.

### Causa exata no código
Em `vite.config.ts`, linha 148:
```js
if (id.match(/[\\/]react(-dom|-router-dom)?[\\/]/)) return 'react-vendor';
```
Esse regex captura `react`, `react-dom` e `react-router-dom`, mas **deixa de fora** dependências internas críticas que o React usa em runtime: `react/jsx-runtime`, `react/jsx-dev-runtime`, `scheduler`, `use-sync-external-store`, `react-is`. Esses módulos caem no chunk genérico `vendor`, criando uma dependência circular onde o `radix-vendor` precisa de coisas que ainda não foram inicializadas.

## Correção

### Mudança única em `vite.config.ts`
Reescrever a regra de chunking para garantir que **todo o ecossistema React fique no mesmo chunk**, e que esse chunk seja referenciado corretamente:

```js
manualChunks: (id) => {
  if (!id.includes('node_modules')) return undefined;

  // React + tudo que depende dele em runtime — precisa estar junto
  if (id.match(/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|use-sync-external-store|react-is|@remix-run[\\/]router)[\\/]/)) {
    return 'react-vendor';
  }

  // Radix depende de React mas não pode entrar no react-vendor (fica gigante)
  if (id.includes('@radix-ui')) return 'radix-vendor';

  if (id.includes('@supabase')) return 'supabase-vendor';
  if (id.includes('@tanstack')) return 'tanstack-vendor';
  if (id.match(/[\\/](recharts|d3-)/)) return 'charts-vendor';
  if (id.match(/[\\/](@dnd-kit|@hello-pangea[\\/]dnd)/)) return 'dnd-vendor';
  if (id.match(/[\\/](jspdf|pdfjs-dist|pptxgenjs|exceljs|jszip|file-saver)/)) return 'docs-vendor';
  if (id.includes('mapbox-gl') || id.includes('@vis.gl/react-google-maps') || id.includes('@googlemaps')) return 'maps-vendor';
  if (id.includes('framer-motion')) return 'motion-vendor';
  if (id.match(/[\\/](react-markdown|remark-|rehype-|micromark|hast-|mdast-|unist-)/)) return 'markdown-vendor';
  if (id.includes('@elevenlabs') || id.includes('pluggy-connect-sdk') || id.includes('react-pluggy-connect')) return 'integrations-vendor';
  if (id.match(/[\\/](date-fns|react-day-picker|react-hook-form|@hookform|zod|sonner|cmdk|vaul|embla-carousel-react|input-otp|driver\.js|class-variance-authority|clsx|tailwind-merge|tailwindcss-animate)/)) return 'ui-utils-vendor';

  return 'vendor';
},
```

Mudanças-chave:
1. Regex agora ancora em `node_modules/` para evitar match em arquivos do app que tenham `react` no nome.
2. Inclui `scheduler`, `use-sync-external-store`, `react-is`, `@remix-run/router` (dependência interna do react-router 6) no `react-vendor`.
3. Mantém `radix-vendor` separado (é grande e tem cache eficiente sozinho), mas agora ele tem garantia de que `react-vendor` foi carregado antes via dependência declarada do bundler.

### Limpar cache do Service Worker
O `vite-plugin-pwa` está com `registerType: 'autoUpdate'` e cacheia o JS antigo quebrado. Após o deploy do build novo, navegadores que já visitaram o site continuariam vendo a versão quebrada por algumas horas. Já existe `cleanupOutdatedCaches: true`, mas para acelerar, adicionar versionamento no `manifest`/cache para forçar invalidação imediata na primeira visita pós-fix.

### Validação após o build
1. Esperar deploy.
2. Abrir `https://bimaster.online` em aba anônima.
3. Console (F12) deve estar limpo, sem `Cannot read properties of undefined (reading 'forwardRef')`.
4. Tela de login do Huggs deve aparecer.
5. Validar `https://bimaster.lovable.app` (mesmo build).

## O que NÃO precisa mexer
- DNS na IONOS (está correto, A records → `185.158.133.1`).
- Cloudflare (não está em uso para este domínio).
- TXT `_lovable` (verificações já passaram).
- Project Settings → Domains da Lovable.

## Risco
Baixo. Mudança isolada em `vite.config.ts` que afeta apenas o agrupamento de chunks. O comportamento do app é idêntico, apenas a ordem/forma de carregar muda. Se algo der errado, o rollback é trivial.
