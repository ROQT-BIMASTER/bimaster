

# Estúdio Criativo com IA — Geração de Imagens e Vídeos

## Contexto
O sistema já possui o Design Studio (Google Stitch) para geração de layouts/UI. O Google Flow é um estúdio criativo para gerar **imagens e vídeos** com IA. Vamos adicionar essas capacidades ao sistema usando os modelos de IA já disponíveis no Lovable AI Gateway.

## O que será construído

### 1. Nova Edge Function: `ai-creative-studio`
Backend dedicado para geração de imagens com os modelos:
- `google/gemini-3.1-flash-image-preview` (rápido, boa qualidade)
- `google/gemini-3-pro-image-preview` (alta qualidade, mais lento)

Funcionalidades:
- **Gerar imagem** a partir de texto (ex: "mockup de batom rosa em fundo marble")
- **Editar imagem** existente (ex: "trocar o fundo para praia", "adicionar logo")
- **Gerar variações** de uma imagem base
- Salvar resultados no Storage bucket `creative-studio`

### 2. Nova página/aba no Design Studio: "Criar Imagem"
Adicionada como nova aba no `StitchDesignStudio` existente:

- **Prompt de texto** com sugestões rápidas (marketing de produto, mockup embalagem, post social)
- **Upload de imagem** para edição com IA (remover fundo, trocar cenário, etc.)
- **Seletor de formato**: Post Instagram (1:1), Story (9:16), Banner (16:9), Embalagem (custom)
- **Seletor de modelo**: Flash (rápido) vs Pro (alta qualidade)
- **Galeria** de imagens geradas com opções de download, editar e reusar

### 3. Tabela `creative_studio_assets`
Armazena metadados das imagens geradas:
- `id`, `user_id`, `prompt`, `image_url`, `model_used`
- `asset_type` (imagem_gerada, imagem_editada)
- `category` (marketing, mockup, social_media)
- `dimensions`, `format`
- RLS por usuário autenticado

### 4. Storage bucket `creative-studio`
Bucket público para armazenar as imagens geradas.

## Sobre vídeo
Os modelos disponíveis geram **imagens**, não vídeos nativos. Para conteúdo de vídeo, implementaremos:
- **Geração de sequência de imagens** (storyboard) que podem ser exportadas
- Preparação para integração futura com APIs de vídeo quando disponíveis

## Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/ai-creative-studio/index.ts` | Criar — edge function de geração/edição |
| `src/components/marketing/studio/CreativeImageGenerator.tsx` | Criar — componente principal |
| `src/components/marketing/studio/CreativeGallery.tsx` | Criar — galeria de assets |
| `src/components/marketing/StitchDesignStudio.tsx` | Editar — adicionar aba "Criar Imagem" |
| Migration SQL | Criar tabela + bucket + RLS |

