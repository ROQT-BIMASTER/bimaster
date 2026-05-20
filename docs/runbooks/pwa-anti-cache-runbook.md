# Runbook — Anti-Cache PWA (Heartbeat + Kill Switch)

**Versão:** 1.0 — 2026-05-20  
**Owners:** Admin / Plataforma  
**Última correção crítica relacionada:** v3.4.96 (heartbeat default ON)

---

## 1. Como o sistema garante "todos na versão mais recente"

Três camadas independentes, todas aditivas e silenciosas em caminho feliz:

| Camada | O que faz | Onde mora |
|---|---|---|
| **A. Service Worker (autoUpdate)** | Verifica novo bundle a cada 2 min; quando o novo SW assume controle, recarrega a página. | `src/contexts/PWAContext.tsx` (`registerSW`, `controllerchange`) |
| **B. Heartbeat de versão** | A cada `visibilitychange→visible` (e 10s pós-mount), compara `APP_VERSION` do bundle local com a `<meta name="app-version">` do `index.html` remoto. Divergência → toast "Nova versão disponível". | `PWAContext.tsx` (`runHeartbeat`) + `vite.config.ts` (`appVersionMetaPlugin`) |
| **C. Kill switch remoto** | Admin insere uma linha em `app_release_pins(min_version)`. Realtime entrega para todos os clientes conectados em segundos. Clientes com `APP_VERSION < min_version` recebem o toast. | `src/lib/releasePin.ts` + `/admin/versoes-clientes` |

A partir da **v3.4.96**, a flag `ff_pwa_heartbeat` vem **ligada por padrão** — B e C operam automaticamente para todos os usuários.

---

## 2. Operação normal (deploy padrão)

Não há ação manual. O fluxo é:

1. Push para `main` → Lovable build → publish.
2. Em até ~2 min, o SW de cada cliente detecta o novo bundle (camada A).
3. Em paralelo, o heartbeat (camada B) detecta divergência no próximo `visibilitychange` e dispara o toast.
4. Usuário clica **"Atualizar agora"** → `updateServiceWorker()` recarrega.
5. Heartbeat de telemetria registra a nova `APP_VERSION` em `client_version_telemetry`.

Acompanhe a propagação em `/admin/versoes-clientes` → **Distribuição de versões**. Em ~24h, ≥95% dos clientes ativos devem estar na versão mais recente.

---

## 3. Operação de emergência — hotfix urgente

**Quando usar:** correção crítica (bug de segurança, dado errado, módulo quebrado) que **não pode esperar** o ciclo normal de 2 min do SW + visibilitychange.

**Pré-requisitos:**
- Você é admin (`has_role(uid, 'admin')`).
- O deploy com a correção já está em produção (confirme `APP_VERSION` em `/admin/versoes-clientes` → "Versão atual deste build").

**Passos:**

1. Vá em **Admin → Versões dos clientes** (`/admin/versoes-clientes`).
2. Confirme o número exato em "Versão atual deste build" (ex.: `3.4.96`).
3. No card **"Forçar atualização (kill switch)"**, preencha:
   - **Versão mínima exigida:** o mesmo número do build atual (ex.: `3.4.96`).
   - **Mensagem (opcional):** descrição curta do motivo. Ex.: `Correção crítica no módulo China — Cláudia`.
4. Clique **"Registrar pin"**. Confirme com sua senha.
5. Em até ~5 segundos, todos os clientes conectados com versão menor recebem o toast "Nova versão disponível".
6. Acompanhe a **"Distribuição de versões"** atualizando. Clientes que estavam abaixo aparecerão na versão nova conforme aceitam o prompt.

**Importante:**
- Cliente offline / app fechado não recebe via Realtime — recebe no próximo abrir (via `fetchLatestPin()` no mount).
- Cliente que clica "Depois" continua na versão antiga até o próximo `visibilitychange`. O toast volta a aparecer.
- Nenhuma sessão é invalidada. Nenhuma permissão muda. O usuário só recarrega o JS.

---

## 4. Escolha do `min_version`

| Cenário | `min_version` |
|---|---|
| Hotfix de segurança / dado | `APP_VERSION` do build com a correção (ex.: `3.4.96`) |
| Deprecação de API antiga consumida pelo front | versão onde o front parou de usar a API |
| Forçar reload "limpo" sem mudança específica | `APP_VERSION` atual (será no-op para quem já está nela) |

**Nunca** registre `min_version` **maior** que o build em produção — todos os clientes (inclusive admin) entrariam em loop de toast sem caminho para sair.

---

## 5. Rollback do kill switch

Não há `DELETE` policy em `app_release_pins` (histórico é imutável). Para "desfazer" um pin:

- Registre um pin **igual ou menor** que a versão mais antiga ainda suportada — a comparação semver volta a passar.
- Ou simplesmente espere: pins não expiram, mas só afetam clientes com `APP_VERSION < min_version`. Após todos atualizarem, o pin vira no-op.

Para reverter por DB (último recurso, admin com acesso SQL):
```sql
-- Inspecionar
SELECT * FROM public.app_release_pins ORDER BY criado_em DESC LIMIT 5;
```
Inserir um novo pin com `min_version` baixo (ex.: `0.0.1`) neutraliza efetivamente o anterior, já que `fetchLatestPin()` lê só o mais recente.

---

## 6. Rollback do heartbeat (caso reapareça falso positivo)

**Desligar individualmente** (usuário isolado, suporte):
```js
localStorage.setItem('ff_pwa_heartbeat', '0');
location.reload();
```

**Desligar globalmente** (regressão ampla — exige redeploy):
- Em `vite.config.ts` (ou env do build): definir `VITE_FF_PWA_HEARTBEAT=0`.
- Ou em `src/lib/featureFlags.ts`, trocar o default da função `isPwaHeartbeatEnabled` para `return false;` e bump de versão.

Mesmo desligado, a camada A (SW autoUpdate) e o telemetria continuam funcionando.

---

## 7. Troubleshooting

| Sintoma | Diagnóstico | Ação |
|---|---|---|
| Usuário diz "não vejo a atualização" | Em `/admin/versoes-clientes` → "Últimos heartbeats", procure o `user_id` e veja a versão. | Se < atual: registrar pin. Se = atual: o problema não é cache — investigar permissão/feature flag. |
| Usuário não aparece em "Últimos heartbeats" | Não logou nas últimas 24h **ou** está em rede que bloqueia o backend. | Pedir para abrir o app e fazer login. Telemetria sobe automaticamente. |
| Toast aparece e desaparece em loop para um usuário específico | `localStorage.app_version` corrompido ou meta tag não está sendo servida. | No DevTools do usuário: `localStorage.removeItem('app_version'); location.reload();`. Em último caso: `localStorage.setItem('ff_pwa_heartbeat','0')`. |
| Pin registrado mas nenhum cliente atualiza | Realtime do backend pode estar degradado, ou clientes estão todos offline. | Validar com `cloud_status`. Aguardar — clientes ainda recebem no próximo open via `fetchLatestPin()`. |
| Build novo publicado mas distribuição não muda em 24h | Service Worker preso em cliente que nunca recebe `visibilitychange` (PWA instalado sempre visível). | Registrar pin com `min_version` = build atual. |

---

## 8. Métricas para acompanhar (semanais)

- **Cobertura de versão:** % de heartbeats nos últimos 7d na versão mais recente. Meta: ≥95%.
- **Tempo para 95%:** quantas horas entre deploy e 95% dos clientes ativos atualizados. Meta: <24h.
- **Uso do kill switch:** quantos pins/mês. Meta: ≤2/mês (excesso = SW autoUpdate está falhando, investigar).

---

## 9. Não-quebra (garantias)

Toda a infraestrutura desta solução é **aditiva e não-destrutiva**:

- ✅ Tabelas (`client_version_telemetry`, `app_release_pins`) são isoladas; nenhuma RLS pré-existente foi alterada.
- ✅ `localStorage` do usuário (preferências, densidade, cores de página, sessão) **nunca é apagado** pelos novos fluxos.
- ✅ O toast "Nova versão disponível" é não-bloqueante; usuário pode dispensar.
- ✅ Telemetria é fire-and-forget com `try/catch` total; falha não afeta login.
- ✅ Realtime do kill switch é silencioso em erro de canal.
- ✅ Rollback do flag não exige migração de dados.

---

## 10. Referências

- Plano original: `docs/audits/2026-05-stale-cache-audit.md`
- Memória: `mem://pwa/anti-cache-versioning`
- UI admin: `/admin/versoes-clientes` (`src/pages/admin/VersoesClientes.tsx`)
- Core lib: `src/lib/releasePin.ts`, `src/lib/version-telemetry.ts`, `src/lib/version.ts`
- Contexto PWA: `src/contexts/PWAContext.tsx`
- Flag: `src/lib/featureFlags.ts` (`isPwaHeartbeatEnabled`)
