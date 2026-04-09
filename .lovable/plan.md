

# Fix Design Studio — Stitch Integration 100% Funcional

## Problemas Identificados

### 1. Parâmetros MCP Errados (causa raiz de TUDO estar quebrado)
A edge function `stitch-proxy` envia parâmetros com nomes errados para a API do Google Stitch:
- `create_project` envia `name` mas a API espera `title`
- `generate_screen` envia `project_id` e `model` mas a API espera `projectId`, `modelId` (com valores `GEMINI_3_FLASH`/`GEMINI_3_1_PRO`), e `deviceType` (`DESKTOP`/`MOBILE`)
- `list_screens` envia `project_id` mas a API espera `projectId`
- `get_screen` envia `project_id`/`screen_id` mas a API espera `name` (format: `projects/{id}/screens/{id}`), `projectId`, `screenId`

### 2. Frontend não detecta erros do Stitch
O proxy retorna `{ success: true, data: { result: { isError: true } } }` — o frontend trata como sucesso.

### 3. Faltam ações essenciais no proxy
- `edit_screens` — editar telas existentes com prompt
- `generate_variants` — gerar variações A/B
- `get_project` — obter detalhes do projeto
- Suporte a `deviceType` e `modelId` corretos

### 4. Sem upload de imagem
O usuário quer enviar imagens/fotos como referência. O Stitch não suporta upload via MCP diretamente, mas podemos usar o Lovable AI (Gemini) para analisar a imagem e gerar um prompt descritivo detalhado que alimenta o Stitch.

### 5. DB save extrai campos errados
O proxy tenta extrair `html`, `preview_url`, `screen_id` do resultado, mas a estrutura real do Stitch retorna `Screen` objects com `htmlCode.downloadUrl`, `screenshot.downloadUrl`, `name`.

---

## Plano de Implementação

### Fase 1: Consertar `stitch-proxy` edge function

**Arquivo**: `supabase/functions/stitch-proxy/index.ts`

- Corrigir mapeamento de parâmetros para TODOS os tools:
  - `create_project`: `{ title }` 
  - `list_projects`: `{ filter? }`
  - `generate_screen_from_text`: `{ projectId, prompt, modelId, deviceType }`
  - `edit_screens`: `{ projectId, selectedScreenIds, prompt, modelId, deviceType }`
  - `generate_variants`: `{ projectId, selectedScreenIds, prompt, variantOptions, modelId }`
  - `list_screens`: `{ projectId }`
  - `get_screen`: `{ name, projectId, screenId }`
  - `get_project`: `{ name }`
- Corrigir schemas Zod: `model` → `modelId` com enum `GEMINI_3_FLASH`/`GEMINI_3_1_PRO`; `type` → `deviceType` com enum `DESKTOP`/`MOBILE`/`TABLET`
- Corrigir extração de dados do resultado para salvar no DB: buscar `htmlCode`, `screenshot`, `name` da resposta
- Propagar `isError` como HTTP 422 ao invés de 200

### Fase 2: Adicionar suporte a imagem como referência

**Arquivo**: `supabase/functions/stitch-proxy/index.ts`

- Nova action `describe_image`: recebe `imageBase64`, chama Lovable AI (Gemini Flash) para gerar descrição detalhada da imagem, retorna texto descritivo
- O frontend envia a imagem, recebe a descrição, injeta no prompt antes de chamar `generate_screen_from_text`

### Fase 3: Atualizar Frontend

**Arquivo**: `src/components/marketing/StitchDesignStudio.tsx`

- Corrigir `handleGenerate`: usar `projectId` (sem prefixo), `modelId: GEMINI_3_FLASH/GEMINI_3_1_PRO`, `deviceType: DESKTOP/MOBILE`
- Adicionar tratamento de `isError` na resposta
- Adicionar upload de imagem de referência (input file + preview)
- Adicionar botão "Editar Tela" que chama `edit_screens` com screen IDs selecionados
- Corrigir mapeamento de dados do resultado (screenshot URL, HTML code URL)
- Adicionar seletor `deviceType` (Desktop/Mobile/Tablet) além do tipo de projeto

**Arquivo**: `src/components/marketing/studio/DesignPreview.tsx`
- Buscar HTML via `downloadUrl` quando `htmlCode` é uma URL ao invés de inline

### Fase 4: Testar todas as ações

- `list_projects` — listar projetos
- `create_project` — criar projeto
- `generate_screen_from_text` — gerar tela
- `edit_screens` — editar tela existente
- `list_screens` — listar telas
- `get_screen` — buscar detalhes + HTML + screenshot

---

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `supabase/functions/stitch-proxy/index.ts` | Reescrever com parâmetros corretos, novas actions, error handling |
| `src/components/marketing/StitchDesignStudio.tsx` | Upload de imagem, deviceType, error handling, corrigir generate |
| `src/components/marketing/studio/DesignPreview.tsx` | Suporte a HTML via URL |

