

## Plano: Upload de Vídeo + Diarização por Falante + Ata de Reunião + Mapa Mental Aprimorado

### O que será feito

1. **Upload de vídeo gravado** na tela de reunião (além da gravação ao vivo)
2. **Transcrição com diarização** — IA identifica e nomeia diferentes falantes
3. **Geração de Ata formal** da reunião (formato profissional)
4. **Mapa Mental aprimorado** — estilo hierárquico expansivo como na imagem de referência (ramificações profundas com múltiplos níveis, nós com textos longos, layout horizontal tipo "mind map" de processo)

---

### Mudanças Necessárias

#### 1. Componente `MeetingRecorder.tsx` — Adicionar upload de vídeo/áudio
- Novo botão "Enviar Gravação" que abre file input aceitando `video/*,audio/*`
- Upload do arquivo para o bucket `meeting-recordings` (já existente)
- Detectar tipo MIME (vídeo mp4/webm ou áudio) e salvar no meeting
- Exibir player de vídeo/áudio após upload

#### 2. Edge Function `meeting-analyze` — Transcrição com diarização + Ata
- Atualizar o prompt de transcrição para:
  - Identificar falantes distintos e atribuir nomes quando mencionados (ex: "João:", "Maria:")
  - Manter formato de diálogo com timestamps aproximados
- Adicionar novo campo `ata` no tool schema com estrutura:
  - **Participantes** identificados
  - **Pauta** (tópicos discutidos)
  - **Deliberações** (decisões tomadas)
  - **Encaminhamentos** (ações com responsáveis)
  - **Próximos passos**
- Salvar ata no campo `summary` ou novo campo dedicado
- Atualizar `mindmap_data` para gerar estrutura profunda (3-4 níveis) com ramos de processo detalhados, similar à imagem de referência

#### 3. Componente `MeetingMindMap.tsx` — Estilo visual aprimorado
- Aumentar `NODE_W` dinamicamente baseado no tamanho do texto (nós com textos longos como na imagem)
- Suportar 4+ níveis de profundidade
- Adicionar tipo "processo" para nós de categoria intermediária
- Melhorar auto-fit para mapas grandes
- Nodes com texto multi-linha (word-wrap) em vez de truncate

#### 4. Página `ReuniaoDetalhe.tsx` — Nova tab "Ata" + transcrição com falantes
- Nova tab "Ata" mostrando o documento formatado em markdown
- Tab "Transcrição" exibindo diálogo com identificação visual de falantes (avatares coloridos)
- Suporte a exibir player de vídeo quando `audio_url` é um vídeo

#### 5. Migração DB
- Adicionar campo `ata` (text) na tabela `meetings` para armazenar a ata gerada
- Adicionar campo `participants` (jsonb) para lista de participantes identificados

### Arquivos Impactados
- `src/components/meetings/MeetingRecorder.tsx` — upload de arquivo
- `src/components/meetings/MeetingMindMap.tsx` — nós dinâmicos, multi-linha, mais níveis
- `src/pages/ReuniaoDetalhe.tsx` — nova tab Ata, player de vídeo, transcrição com falantes
- `supabase/functions/meeting-analyze/index.ts` — diarização, ata, mindmap profundo
- Nova migração SQL — campos `ata` e `participants`

