

# Design Studio Profissional — Evolução para Padrão de Mercado

## Diagnóstico Atual

O Design Studio hoje é **funcional mas básico**: prompt de texto → gerar via Stitch → galeria. Comparado com ferramentas de mercado (Canva, Adobe Express, Figma), faltam camadas essenciais para uma equipe de arte operar no dia a dia.

## O Que Falta (vs. Canva / Adobe Express / Figma)

| Capacidade | Canva/Adobe | Huggs Atual | Gap |
|---|---|---|---|
| Templates prontos por categoria | Sim | Não | Crítico |
| Editor visual inline (preview live) | Sim | Não | Alto |
| Biblioteca de assets (logos, fontes, paletas) | Sim | Parcial (CreativeHub) | Médio |
| Versionamento de design | Sim | Não | Alto |
| Colaboração e aprovação | Sim | Não | Alto |
| Geração de variações (A/B) | Sim | Não | Médio |
| Exportação multi-formato (PNG/PDF/SVG) | Sim | Só HTML | Crítico |
| Prompts inteligentes por segmento | Não | Não | Diferencial |
| Integração com calendário editorial | Parcial | Não | Alto |

## Plano de Evolução — 6 Módulos

### 1. Template Library — Biblioteca de Templates por Categoria

Adicionar uma seção de templates pré-configurados com prompts otimizados por tipo de peça:

- **Categorias**: Post Instagram (1:1), Story/Reels (9:16), Banner Web (16:9), Embalagem, Rótulo, Material PDV, Email Marketing, Catálogo
- Cada template tem: thumbnail, prompt base editável, dimensões, tags
- Persistidos na tabela `stitch_templates` (nova)
- Ao selecionar, o prompt é preenchido automaticamente, usuário ajusta e gera

### 2. Preview Live + Editor de Código

Substituir a galeria estática por um preview interativo:

- Renderizar o HTML/CSS retornado pelo Stitch em um iframe sandbox
- Botão "Editar Código" abre editor inline (Monaco/CodeMirror simplificado)
- Alterações no código atualizam o preview em tempo real
- Permite ajustes manuais pós-geração sem sair do painel

### 3. Versionamento e Variações A/B

- Ao gerar um novo design a partir do mesmo prompt (ou prompt modificado), vincular como "versão" do original
- Campo `parent_design_id` na tabela `stitch_designs`
- Interface de comparação lado a lado (2 designs)
- Badge "V1", "V2", "V3" nos cards da galeria
- Botão "Gerar Variação" que clona o prompt com instrução de variação automática

### 4. Fluxo de Aprovação

Integrar com o fluxo de projetos existente:

- Botão "Enviar para Aprovação" no card do design
- Status: Rascunho → Em Revisão → Aprovado → Publicado
- Campo `status` e `approved_by` na tabela `stitch_designs`
- Comentários inline (tabela `stitch_design_comments`)
- Notificação ao aprovador (integração com sistema de notificações existente)

### 5. Brand Kit — Paleta de Marca

Seção para configurar a identidade visual da empresa:

- Upload de logo (Storage)
- Paleta de cores (primária, secundária, acento)
- Fontes preferidas
- Tom de voz / diretrizes visuais em texto
- Ao gerar um design, o Brand Kit é injetado automaticamente no prompt (ex: "use as cores #E91E78 e #1A1A2E, fonte moderna sans-serif, tom premium")
- Tabela `brand_kits` com RLS por empresa

### 6. Exportação Multi-formato + Integração Calendário

- Exportar design como PNG (screenshot do preview via API)
- Exportar como PDF (html-to-pdf via edge function)
- Botão "Agendar como Post" que abre o `SchedulePostDialog` com a imagem do design já anexada
- Vincular design a uma tarefa do Mission Control (campo `tarefa_id`)

## Arquitetura de Dados (Novas Tabelas)

```text
stitch_templates
├── id, nome, categoria, prompt_base, dimensoes, thumbnail_url, tags[], is_active

stitch_designs (atualizar)
├── + parent_design_id (FK self), version_number, status, approved_by, tarefa_id

stitch_design_comments
├── id, design_id (FK), user_id, comment, created_at

brand_kits
├── id, empresa_id, user_id, logo_url, cores_primarias[], cores_secundarias[], fontes[], diretrizes_visuais
```

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---|---|
| Migração SQL | Templates, comments, brand_kits + updates em stitch_designs |
| `src/components/marketing/studio/TemplateLibrary.tsx` | Galeria de templates com filtros |
| `src/components/marketing/studio/DesignPreview.tsx` | Preview live com iframe + editor de código |
| `src/components/marketing/studio/VersionCompare.tsx` | Comparação lado a lado |
| `src/components/marketing/studio/ApprovalFlow.tsx` | Status + comentários + aprovação |
| `src/components/marketing/studio/BrandKitManager.tsx` | Configuração de identidade visual |
| `src/components/marketing/studio/ExportOptions.tsx` | PNG/PDF/Agendar como Post |
| `src/components/marketing/StitchDesignStudio.tsx` | Refatorar com sub-tabs para os 6 módulos |

## Resultado Final

O Design Studio passaria de uma ferramenta de geração simples para um **hub criativo completo** com:

- Geração assistida por IA (Stitch + Brand Kit)
- Templates profissionais por categoria
- Preview e edição inline
- Versionamento e A/B testing visual
- Fluxo de aprovação integrado ao time
- Exportação multi-formato e publicação direta

Isso posiciona o módulo no nível de um **Canva corporativo interno**, com a vantagem de estar integrado ao ERP, calendário editorial, gestão de influenciadores e fluxo de projetos — algo que nenhuma ferramenta de mercado oferece de forma unificada.

