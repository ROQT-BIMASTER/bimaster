

# Integração com Google Stitch — Proposta para Equipe de Arte e Criação

## O que é o Google Stitch

Google Stitch é uma ferramenta de design de UI com IA do Google Labs que transforma prompts de texto, wireframes desenhados à mão ou screenshots em interfaces editáveis e código front-end pronto para produção (HTML/CSS/Tailwind). Usa Gemini 2.5 Pro/Flash como motor. Permite exportar para Figma e gerar código estático.

## Integração via MCP API

O Stitch oferece um **MCP Server remoto** (Model Context Protocol) com endpoint `https://stitch.googleapis.com/mcp`, autenticado via API Key (`X-Goog-Api-Key`). As operações disponíveis são:

| Ferramenta | Descrição |
|---|---|
| `create_project` | Criar novo projeto de design |
| `list_projects` | Listar projetos ativos |
| `list_screens` / `get_screen` | Gerenciar telas dentro de um projeto |
| `generate_screen_from_text` | Gerar tela a partir de prompt de texto |

**Limites gratuitos:** 350 gerações/mês (Flash) + 50 gerações/mês (Pro). Sem cartão de crédito.

## Como funcionaria no sistema Huggs

A integração conectaria o Stitch ao módulo de Marketing/Criação, permitindo que a equipe de arte gere layouts de UI, mockups de embalagens e peças visuais direto do painel.

### Fluxo proposto

```text
Equipe de Arte → Painel Stitch (no Huggs)
     │
     ├─ Prompt de texto → Stitch API → Tela gerada (preview)
     ├─ Upload screenshot/wireframe → Stitch → Redesign IA
     ├─ Exportar → Figma (link direto)
     ├─ Exportar → HTML/CSS (código pronto)
     └─ Salvar na Galeria de Criativos (banco interno)
```

## Plano de Implementação

### Fase 1 — Backend: Edge Function `stitch-proxy`

**Arquivo:** `supabase/functions/stitch-proxy/index.ts`

- Proxy seguro para a API MCP do Stitch
- Rotas: `create_project`, `list_projects`, `generate_screen`, `get_screen`, `export_code`
- A API Key do Stitch fica segura no servidor (secret `STITCH_API_KEY`)
- Validação Zod nos inputs, rate limiting, audit log
- Autenticação JWT obrigatória

### Fase 2 — Frontend: Painel Stitch no módulo Marketing

**Arquivo:** `src/components/marketing/StitchDesignStudio.tsx`

- Nova aba "Design Studio (Stitch)" no `SocialMediaMonitoring.tsx` ou como seção no Creative Hub
- Interface com:
  - Campo de prompt + seleção de modelo (Flash/Pro)
  - Tipo de projeto (App Mobile / Web)
  - Preview da tela gerada (imagem retornada pela API)
  - Botões: "Exportar Figma", "Copiar HTML/CSS", "Salvar na Galeria"
  - Histórico de gerações com thumbnails

### Fase 3 — Galeria de Designs

**Arquivo:** Migração SQL para tabela `stitch_designs`

- Campos: `id`, `user_id`, `project_id_stitch`, `screen_id`, `prompt`, `preview_url`, `html_code`, `figma_export_url`, `model_used`, `created_at`
- RLS: usuário vê apenas seus designs, admin/supervisor vêem todos

### Fase 4 — Integração com fluxo de Projetos/Artes

- Vincular design gerado a um Projeto existente (FK `projeto_id`)
- Usar como referência visual no fluxo de aprovação de artes (Etiqueta, Embalagem)
- Permitir que o time de Regulatório visualize o mockup junto com as informações técnicas

## O que sugiro para a equipe de arte e criação

1. **Prototipagem rápida**: Gerar mockups de embalagens, rótulos e materiais de PDV em segundos com prompt de texto, sem depender de designer externo para a primeira versão
2. **Iteração com IA**: Fazer ajustes descrevendo mudanças em linguagem natural ("trocar fundo para azul", "adicionar logo no canto superior")
3. **Exportação para Figma**: O design gerado pode ser enviado para Figma para refinamento profissional pela equipe
4. **Banco de referências**: Salvar todas as gerações como referência visual para briefings e aprovações
5. **Combinação com ferramentas existentes**: Usar junto com o `ProductCreativeGenerator` (já existente) e o `AiBannerGenerator` — Stitch para layouts/UI, os geradores atuais para criativos de produto e banners

## Pré-requisito

O usuário precisará criar uma API Key gratuita em `stitch.withgoogle.com` (seção Settings) e adicioná-la como secret no projeto.

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Secret `STITCH_API_KEY` | Solicitar ao usuário |
| `supabase/functions/stitch-proxy/index.ts` | Edge function proxy MCP |
| `src/components/marketing/StitchDesignStudio.tsx` | Painel de design com Stitch |
| `src/components/marketing/SocialMediaMonitoring.tsx` | Adicionar aba "Design Studio" |
| Migração SQL | Tabela `stitch_designs` + RLS |

