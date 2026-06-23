# ROUTES — Inventário (Auditoria 2026-Q2)

> Snapshot descritivo do roteamento declarado em `src/App.tsx`. Gerado em junho/2026.
> Substituído por saída automatizada no PR-4 (`scripts/audit/list-routes.ts`).

## 1. Totais

| Métrica | Valor |
| --- | ---: |
| `<Route ... />` em `App.tsx` | **357** |
| Paths únicos | 356 |
| Páginas (`src/pages/**/*.tsx`) | 341 |
| Páginas raiz (`src/pages/*.tsx`) | 235 |

A diferença páginas × rotas é esperada: várias páginas são montadas em mais de
uma rota (ex.: aliases `/dashboard/projetos/:id` e `/dashboard/projetos/:id/tarefa/:tid`).

## 2. Distribuição por área (primeiro segmento)

| Área | Rotas |
| --- | ---: |
| `/dashboard/*` | 312 |
| `/admin/*` (fora de dashboard) | 8 |
| `/auth/*` | 3 |
| `/portal/*` (cliente externo) | 3 |
| `/configuracoes/*` | 2 |
| `/projetos/convite/:token` | 1 |
| Páginas públicas (`/`, `/privacidade`, `/termos`, `/contato`, `/cofre-share`, `/formulario-*`, `/unsubscribe`, `/usuario-bloqueado`, `/aguardando-aprovacao`, `/reset-password`, `/index.html`, `/index`, `/home`, `/meu-perfil`, `/not-found`, `*`) | 28 |

## 3. Dentro de `/dashboard/*` — distribuição por módulo

| Módulo (2º segmento) | Rotas | Guard típico |
| --- | ---: | --- |
| `trade` | 53 | Module |
| `financeiro` | 30 | Module + Screen |
| `fabrica` | 27 | Module + Screen |
| `projetos` | 20 | Module |
| `estoque` | 18 | Module |
| `fabrica-china` | 17 | Module |
| `admin` | 17 | Module + role check |
| `marketing` | 9 | Module |
| `comercial` | 9 | Module |
| `configuracoes` | 8 | Module |
| `prospects` | 7 | Module |
| `processos` | 7 | Module |
| `precos` | 7 | Module + Screen |
| `departamentos` | 5 | Module |
| `central` (Central de Trabalho + Copilot) | 5 | Module |
| `fornecedor` | 4 | Module |
| `eventos` | 4 | Module |
| `oms` | 3 | Module |
| `integracoes` | 3 | Module |
| `reunioes`, `compras-internacionais`, `composicao`, `chat`, `briefings` | 2 cada | Module |
| `vendas`, `tarefas`, `simulacao`, `security-explorer`, `seguranca-dashboard`, `trilha-auditoria-acessos`, demais | 1 cada | Module / role |

## 4. Guards aplicados

Resumo dos guards encontrados (ver `src/components/auth/*`):

| Guard | Onde se aplica |
| --- | --- |
| `ProtectedRoute` | toda rota autenticada (`/dashboard/*`, `/admin/*`, `/configuracoes/*`, `/meu-perfil`) |
| `ModuleProtectedRoute` | módulos do catálogo `modulos_sistema` |
| `ScreenProtectedRoute` | telas individuais com permissão granular |
| `ClienteProtectedRoute` | `/portal/*` (sessão de cliente externo, separada da árvore `EmpresaProvider`) |
| `AdminRoute` (variantes) | rotas administrativas sensíveis |

## 5. Achados

### 5.1 🟢 Distribuição saudável
312 das 357 rotas (≈87%) estão sob `/dashboard/*` com a tripla `Protected →
Module → Screen`. Não há rotas autenticadas escapando do prefixo.

### 5.2 🟡 [MÉDIO] Rotas públicas exigem inventário individual
As 28 rotas públicas (formulários dinâmicos, share de cofre, unsubscribe,
política, etc.) devem ser auditadas em PR-4 quanto a:
- Rate limiting na camada de função/edge (já parcialmente coberto);
- Tokens com expiração (`team_form_tokens`, `cofre_share_tokens`, `email_unsubscribe_tokens` — todos com tabela própria).

### 5.3 🟡 [MÉDIO] Aliases em Projetos
O módulo Projetos tem ≥20 rotas, várias compartilhando o mesmo componente
(`ProjetoTarefaDetalhe`) com paths diferentes para abertura via deep-link.
**Não editar** (regra do ciclo). Documentar mapping completo em PR-4.

### 5.4 🟢 Portal de Cliente isolado
3 rotas em `/portal/*` operam fora da árvore `EmpresaProvider`, com guard e
políticas RLS próprias. Isolamento correto.

## 6. Como reproduzir

```bash
# Total
rg -c '<Route ' src/App.tsx

# Paths únicos
rg -oP 'path="[^"]+"' src/App.tsx | sort -u

# Distribuição por 1º segmento
rg -oP 'path="/[^"/]+' src/App.tsx | sort | uniq -c | sort -rn

# Distribuição dentro de /dashboard
rg -oP 'path="/dashboard/[^"/]+' src/App.tsx | sort | uniq -c | sort -rn
```
