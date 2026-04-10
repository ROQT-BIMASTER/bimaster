

# Motor de Vídeo com IA de Última Geração

## Diagnóstico

O endpoint `generate-video` atual chama `https://ai.gateway.lovable.dev/v1/videos/generations` que **não existe** — cai no chat completions e retorna texto em vez de vídeo. A geração nunca funciona.

## Solução: Integração com fal.ai

O **fal.ai** é a plataforma que agrega os modelos de vídeo mais avançados do mundo em uma única API REST:
- **Google Veo 3** — o modelo mais avançado, com áudio nativo
- **Kling 2.0 Master** — alta fidelidade, image-to-video
- **MiniMax (Hailuo AI)** — text-to-video e image-to-video
- **Luma Dream Machine** — transformações criativas

Você precisará criar uma conta em [fal.ai](https://fal.ai) e fornecer sua API Key (FAL_KEY).

## O que será construído

### 1. Edge Function `fal-video-generate`
- Suporta **3 modos de entrada**:
  - **Texto (prompt)** → text-to-video via Veo 3 ou MiniMax
  - **Imagem** → image-to-video via Kling 2.0 ou MiniMax I2V
  - **Documento/arquivo** → IA extrai briefing do documento (via Lovable AI), depois gera vídeo
- Sistema de queue (fal.ai é assíncrono): submit → poll status → get result
- Seletor de modelo (Veo 3, Kling 2.0, MiniMax)

### 2. Edge Function `fal-video-status`
- Polling do status de geração (fal.ai retorna requestId)
- Retorna progresso e URL final do vídeo

### 3. UI Renovada — `AdvancedVideoGenerator.tsx`
- **3 abas de entrada**: Prompt | Imagem | Documento
- Upload de imagem com preview
- Upload de documento (PDF, DOCX, TXT) — IA analisa e extrai prompt
- Seletor de modelo com descrição de cada um
- Polling visual com progress bar real
- Player de vídeo integrado com download
- Galeria de vídeos gerados (persistidos no banco)

### 4. Tabela `generated_videos`
- `id`, `user_id`, `prompt`, `model_used`, `input_type` (text/image/document)
- `video_url`, `status`, `fal_request_id`, `duration`, `aspect_ratio`
- RLS por usuário

### 5. Integração no Design Studio
- Nova aba "Gerar Vídeo" no StitchDesignStudio com o componente avançado

## Fluxo técnico

```text
[Usuário] → prompt/imagem/documento
     ↓
[fal-video-generate] → (se documento: Lovable AI extrai briefing)
     ↓
[fal.ai API] → submit job → retorna requestId
     ↓
[fal-video-status] → poll a cada 5s → retorna video URL
     ↓
[UI] → exibe vídeo + salva no banco
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/fal-video-generate/index.ts` | Criar — geração via fal.ai |
| `supabase/functions/fal-video-status/index.ts` | Criar — polling de status |
| `src/components/marketing/studio/AdvancedVideoGenerator.tsx` | Criar — UI completa |
| `src/components/marketing/StitchDesignStudio.tsx` | Editar — adicionar aba |
| Migration SQL | Criar tabela `generated_videos` + RLS |

## Pré-requisito

Será solicitada a **FAL_KEY** (API Key do fal.ai) antes de prosseguir com a implementação.

