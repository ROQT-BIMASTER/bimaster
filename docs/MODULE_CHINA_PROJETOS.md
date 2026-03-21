# Módulo: China + Projetos + Onboarding Brasil

> **Última atualização:** 2026-03-21 | **Versão:** 2.0.0

---

## 1. Visão Geral

Este documento cobre três módulos interligados:

1. **Fábrica China** (`china`) — Submissão de fichas de produto, ordens de compra e embarques
2. **Projetos** (`projetos`) — Gestão de projetos com hierarquia e vinculação a módulos
3. **Onboarding Brasil** — PLM para transição de produtos importados ao cadastro nacional

---

## PARTE A: FÁBRICA CHINA

### Guard: `moduleCode="china"` | Rota Base: `/dashboard/fabrica-china`

### Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/dashboard/fabrica-china` | `ChinaFabrica` | Hub — lista de submissões |
| `/dashboard/fabrica-china/nova` | `ChinaNovaSubmissao` | Nova submissão |
| `/dashboard/fabrica-china/nova/:submissaoId` | `ChinaNovaSubmissao` | Edição de submissão |
| `/dashboard/fabrica-china/recebimentos` | `ChinaRecebimentos` | Recebimentos da China |
| `/dashboard/fabrica-china/ordens` | `ChinaOrdens` | Ordens de compra |
| `/dashboard/fabrica-china/ordens/:id` | `ChinaOrdemDetalhe` | Detalhe da OC |
| `/dashboard/fabrica-china/submissao/:id` | `ChinaSubmissaoDetalhe` | Detalhe da submissão |
| `/dashboard/fabrica-china/produto/:id` | `ChinaFichaProduto` | Ficha completa do produto |

---

### Tabelas China (~18 tabelas)

| Tabela | Colunas-Chave | Descrição |
|--------|--------------|-----------|
| `china_produto_submissoes` | id, numero_ficha, produto_nome, produto_codigo, status, etapa_atual, created_by, projeto_id | Ficha principal de submissão |
| `china_produto_documentos` | id, submissao_id, tipo_documento, arquivo_path, status_revisao, rodada_atual | Documentos anexos |
| `china_doc_revisoes` | id, documento_id, submissao_id, resultado, motivo_rejeicao, revisado_por, rodada, contestacao_texto | Histórico de revisões |
| `china_ordens_compra` | id, numero_oc, submissao_id, produto_codigo, produto_nome, qty_total, qty_produzida, status, data_emissao | Ordens de compra |
| `china_embarques` | id, ordem_compra_id, numero_bl, numero_container, data_embarque, data_eta, porto_origem, porto_destino, status | Logística |
| `china_embarque_documentos` | id, embarque_id, tipo, arquivo_path | Documentos do embarque |
| `china_cofre_produto` | id, submissao_id, tipo, dados_criptografados | Cofre digital seguro |
| `china_chat_mensagens` | id, submissao_id, usuario_id, conteudo, tipo, anexos, mencoes | Chat por submissão |
| `china_checklist_custom_categorias` | id, submissao_id, label_pt, label_cn, fluxo, ordem | Categorias de checklist custom |
| `china_checklist_custom_itens` | id, submissao_id, label_pt, label_cn, tipo_key, categoria_custom_id | Itens de checklist |
| `china_ficha_despachos` | id, submissao_id, modulo_destino, despachado_por, usuario_destino_id | Despachos oficiais |
| `china_ficha_visibilidade` | id, submissao_id, user_id, pode_despachar | Controle de acesso por ficha |
| `china_categoria_responsaveis` | id, categoria_key, responsavel_id, projeto_id | Responsáveis por categoria |
| `china_documento_tarefa_vinculos` | id, documento_id, tarefa_id, projeto_id, secao_id | Vínculo doc → tarefa |

### Fluxo de Status da Submissão

```
rascunho
  │
  ▼
em_revisao ◄────────────────────────────┐
  │                                      │
  ├─ aprovado ────► em_producao          │
  │                   │                  │
  │                   ▼                  │
  │               embarcado              │
  │                   │                  │
  │                   ▼                  │
  │               recebido               │
  │                                      │
  └─ rejeitado ─────► (correção) ────────┘
```

### Caixa de Validação IA

A validação automática por IA verifica:
- Completude dos campos obrigatórios
- Consistência de dimensões e pesos
- Conformidade regulatória (ANVISA, INMETRO)
- Compatibilidade de embalagem

### Cofre do Produto

Armazena dados sensíveis (fórmulas, custos de fábrica) com criptografia. Compartilhamento via link temporário (`/cofre-share`).

**Edge Function**: `cofre-share` — gera link público temporário com dados descriptografados.

---

## PARTE B: PROJETOS

### Guard: `moduleCode="projetos"` | Rota Base: `/dashboard/projetos`

### Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/dashboard/projetos` | `Projetos` | Lista de projetos |
| `/dashboard/projetos/inbox` | `ProjetoInbox` | Inbox de notificações |
| `/dashboard/projetos/aprovacoes` | `ProjetoAprovacaoCadastro` | Aprovações de cadastro |
| `/dashboard/projetos/minha-equipe` | `ProjetosMinhaEquipe` | Projetos da equipe |
| `/dashboard/projetos/vincular-china` | `ProjetoVincularChina` | Vincular submissão China |
| `/dashboard/projetos/produto-brasil` | `ProdutosBrasilListagem` | Lista produtos Brasil |
| `/dashboard/projetos/produto-brasil/:id` | `ProdutoBrasilCadastro` | Cadastro produto Brasil |
| `/dashboard/projetos/:id` | `ProjetoDetalhe` | Detalhe do projeto |

### Tabelas Projetos

| Tabela | Colunas-Chave |
|--------|--------------|
| `projetos` | id, nome, descricao, status, tipo, data_inicio, data_fim_prevista, responsavel_id, empresa_id |
| `projeto_secoes` | id, projeto_id, nome, ordem, cor |
| `projeto_tarefas` | id, secao_id, projeto_id, titulo, descricao, status, prioridade, responsavel_id, data_limite |
| `projeto_comentarios` | id, tarefa_id, usuario_id, conteudo |
| `projeto_anexos` | id, tarefa_id, arquivo_path, nome_arquivo |

### Hierarquia

```
Projeto
  ├─ Seção 1 (fase)
  │    ├─ Tarefa 1.1
  │    ├─ Tarefa 1.2
  │    └─ Tarefa 1.3
  ├─ Seção 2
  │    └─ Tarefa 2.1
  └─ Seção N
```

### Vinculação com Módulos

Um projeto pode vincular:
- **Submissões China** → `china_documento_tarefa_vinculos`
- **Produtos Brasil** → `produtos_brasil.projeto_id`
- **Processos de aprovação** → fluxo de aprovação de cadastro

### Edge Functions

| Function | Descrição |
|----------|-----------|
| `projeto-ia-assistant` | Assistente IA para gestão de projetos |
| `projeto-monitor-atrasos` | Monitora tarefas atrasadas e envia alertas |
| `audit-china-vinculo` | Audita vinculações China ↔ Projeto |
| `audit-produto-tarefa` | Audita vínculos produto ↔ tarefa |
| `audit-briefing-tarefa` | Audita briefings de tarefas |

---

## PARTE C: ONBOARDING BRASIL (PLM)

### Conceito

Sistema de Product Lifecycle Management para transição de produtos importados (China) ao cadastro nacional brasileiro.

### Tabelas PLM

| Tabela | Colunas-Chave | Descrição |
|--------|--------------|-----------|
| `produtos_brasil` | id, projeto_id, submissao_china_id, nome, codigo, marca, status, created_by | Produto nacional |
| `produtos_brasil_custos` | id, produto_brasil_id, tipo_custo, valor, moeda, data_referencia | Custos (FOB, CIF, imposto, etc.) |
| `produtos_brasil_precos` | id, produto_brasil_id, canal, regiao, preco_sugerido, margem | Preços por canal/região |
| `produtos_brasil_grade` | id, produto_brasil_id, tamanho, cor, ean, estoque_inicial | Grade (SKUs) |

### Fluxo de Onboarding

```
Submissão China aprovada
  │
  ▼
Vincular a Projeto (obrigatório para finalização)
  │
  ▼
Criar Produto Brasil (manual ou via vínculo)
  │
  ├─ Comparação lado a lado (China vs Brasil)
  ├─ Image Timeline (5 etapas visuais)
  ├─ Gestão de Grade (drag-and-drop)
  ├─ Custos (FOB, CIF, II, IPI, ICMS, PIS, COFINS)
  ├─ Preços por canal/região
  └─ Checklist regulatório (7 itens)
       │
       ▼
  Produto finalizado → ativo no sistema Brasil
```

### Isolamento

Produtos Brasil usam tabelas **próprias** (`produtos_brasil_*`), isoladas de `fabrica_produtos_acabados`. Isso garante que produtos importados não afetem a produção nacional.

---

## PARTE D: GOVERNANÇA E APROVAÇÃO

### Pasta Digital (estilo TJSP)

Árvore hierárquica de documentos por fase:

```
Projeto X
  ├─ Fase 1: Documentação Inicial
  │    ├─ Ficha Técnica (pg 1-15)
  │    ├─ Certificados (pg 16-22)
  │    └─ Laudos (pg 23-30)
  ├─ Fase 2: Análise Departamental
  │    ├─ Regulatório → Parecer: Aprovado ✓
  │    ├─ Qualidade → Parecer: Pendência ⚠
  │    └─ Comercial → Parecer: Aguardando
  └─ Fase 3: Produção
```

### Pareceres Departamentais

Cada departamento emite parecer formal:
- **Aprovado** ✅
- **Pendência** ⚠️ (com motivo)
- **Rejeitado** ❌ (com motivo)

Registro de autoria e data obrigatórios.

### Rodadas de Aprovação

```
Rodada 1: China envia documentos
  └─ Brasil revisa
       ├─ Aprovado → próxima fase
       └─ Rejeitado (com anotações de erro)
            └─ China contesta (china_doc_revisoes.contestacao_texto)
                 └─ Rodada 2: China reenvia
                      └─ Brasil re-revisa...
```

### Assinatura Eletrônica

Documentos oficiais do Brasil (Etiquetas, EANs, Amostras) requerem:
1. **Oficialização** — marcar como oficial
2. **Assinatura eletrônica** — senha obrigatória: `bimaster2026`
3. **Liberação** — disponível para a China

### Painel Unificado (Two-Column)

```
┌─────────────────────┬─────────────────────┐
│  CHINA ENVIA →      │  ← BRASIL ENVIA     │
│                     │                     │
│ • Ficha Técnica     │ • Etiqueta aprovada │
│ • Fotos produto     │ • EANs definidos    │
│ • Certificados      │ • Amostra enviada   │
│                     │                     │
│ Status: Enviado     │ Status: Assinado    │
│ Ciência: ✓ Brasil   │ Ciência: ✓ China    │
└─────────────────────┴─────────────────────┘
```

---

## Referências

- [Mapa de Módulos](./MODULES_OVERVIEW.md)
- [Módulo Fábrica Brasil](./MODULE_FABRICA.md)
- [Infraestrutura](./INFRASTRUCTURE.md)
