# Auditoria — Por que correções do dev não aparecem para todos os usuários

**Data:** 2026-05-20  
**Escopo:** entender por que fixes/melhorias aplicados pelo admin não chegam imediatamente a usuários finais (caso reportado: módulo China, usuária Cláudia).  
**Conclusão antecipada:** não é problema de permissão nem RLS. É **cache de navegador + Service Worker servindo bundle JS antigo**.

---

## 1. O que foi varrido

| Suspeita | Resultado | Risco |
|---|---|---|
| `staleTime: Infinity` em queries (cache "para sempre" mascararia fixes) | **Zero ocorrências** em `src/` | — |
| Checks hardcoded de admin por e-mail / UID (`user.email === '...'`) | **Zero ocorrências** em código fonte | — |
| `localStorage` com cache de role (`user_role_cache`) usado para esconder/mostrar UI | Existe (`AuthContext.tsx:238`, `useInactivityTimeout.ts:68`, `UsuarioBloqueado.tsx:14`) mas **apenas para limpeza no logout** — não é fonte de truth de permissão | Baixo |
| `queryClient.defaultOptions` agressivo demais | `staleTime: 5 min` + `refetchOnWindowFocus: false` + `refetchOnReconnect: false` | **Médio** — usuário não vê dados novos por até 5 min ao voltar para a aba, mas não é a causa de bugs visuais reaparecerem |
| Service Worker servindo bundle JS antigo | **Causa raiz confirmada** (ver §2) | **Alto** |

## 2. Causa raiz — deadlock de versão

Fluxo atual em `src/lib/version.ts`:

```
APP_VERSION (constante embutida no bundle JS)
       │
       └─► checkAndUpdateVersion()
              compara com localStorage.app_version
              se diferente → clearAllCaches()
```

**Falha:** quando o Service Worker está servindo o bundle JS antigo (por `NetworkFirst` do `index.html` cair no cache em 3s, ou por SW antigo travado em `waiting`), o `APP_VERSION` que o JavaScript lê é o **antigo**, igual ao do `localStorage`. O check nunca dispara. O cache nunca é limpo. Loop fechado.

### Agravantes encontrados

- **Lovable hosting não honra `public/_headers`** (já documentado em `mem://infra/cloudflare-worker-deploy`). Somente `china.bimaster.online` (via Cloudflare Worker em `cloudflare/worker.js`) força `Cache-Control: no-cache` em `index.html`. Tráfego direto a `bimaster.lovable.app` depende do que a borda Lovable decide.
- `vite.config.ts:78` usa `networkTimeoutSeconds: 3` no `NetworkFirst` do `index.html`. Em rede instável (mobile fraco, 4G congestionado), o cliente cai para o cache em 3s e recebe `index.html` antigo apontando para chunks de bundle antigos.
- `controllerchange` em `PWAContext.tsx:147` recarrega a página sem aviso quando o novo SW assume controle. Em Safari/iOS, esse evento não dispara consistentemente após `skipWaiting`, prolongando o estado preso.
- Sem **telemetria** de qual versão cada cliente está usando — admin não tem como saber quem ficou preso antes do usuário reclamar.

## 3. O que **não** é o problema

- RLS está correto. Não há vazamento nem bloqueio indevido.
- `usuario_permissoes_modulos` está aplicada onde precisa.
- Não há feature flag escondendo bugfixes só para admin.
- Não há cache de TanStack Query suficientemente longo para explicar o sintoma reportado.

## 4. Próximos passos

Ver `.lovable/plan.md` (fases 2–4):

- **Fase 2** — Heartbeat de versão via meta tag em `index.html` (quebra o deadlock).
- **Fase 3** — Telemetria de versão por cliente.
- **Fase 4** — Kill switch remoto via Realtime para hotfixes urgentes.

Princípio comum: cada fase é aditiva, reversível e atrás de feature flag.
