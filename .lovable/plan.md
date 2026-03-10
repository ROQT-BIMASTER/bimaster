

## Aprimorar Dialog "Criar com IA" — Tipo de Criação, Upload de Arquivos e Documentos Vinculados

### Resumo

Transformar o dialog `CriarTarefasIADialog` em um fluxo mais completo com 3 melhorias:

1. **Seletor de tipo de criação** — Checkboxes para escolher criar "Seções", "Tarefas" ou ambos
2. **Upload de planilha/imagem** — O sistema envia o conteúdo para a IA que interpreta e sugere seções e/ou tarefas
3. **Upload de documentos** — Arquivos anexados são salvos vinculados às tarefas criadas

### Implementação

**1. Nova tabela `projeto_tarefa_documentos`**

Migration SQL para armazenar documentos vinculados a tarefas:
```sql
CREATE TABLE public.projeto_tarefa_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.projeto_tarefa_documentos ENABLE ROW LEVEL SECURITY;
-- RLS: usuários autenticados podem inserir/ler
CREATE POLICY "Authenticated users can manage task documents"
  ON public.projeto_tarefa_documentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

Storage bucket para os arquivos:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('projeto-documentos', 'projeto-documentos', true);
CREATE POLICY "Auth users upload projeto docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'projeto-documentos');
CREATE POLICY "Auth users read projeto docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'projeto-documentos');
```

**2. Atualizar Edge Function `projeto-ia-assistant`**

Adicionar nova action `create_from_file` que:
- Recebe `fileContent` (texto extraído ou base64 de imagem), `createType` ("secoes", "tarefas", "ambos"), `projetoId`, `secoes`
- Usa modelo multimodal (`google/gemini-2.5-flash`) para interpretar planilhas/imagens
- Retorna `{ secoes: [{nome}], tasks: [{titulo, secao_nome, ...}] }` via tool calling
- O tool schema inclui tanto seções quanto tarefas, filtradas pelo `createType`

Atualizar `handleCreateTasks` para aceitar `createType` e incluir criação de seções no schema.

**3. Atualizar `CriarTarefasIADialog.tsx`**

- **Step "input"**: Adicionar:
  - **Checkboxes de tipo**: `[x] Seções` `[x] Tarefas` (ambos marcados por padrão)
  - **Área de upload**: Botão/dropzone para subir planilha (.xlsx, .csv) ou imagem (.png, .jpg)
  - **Área de documentos**: Segundo dropzone "Documentos para vincular às tarefas" (qualquer tipo de arquivo)
  - Manter o textarea de prompt (agora opcional se arquivo foi enviado)

- **Step "review"**: Mostrar resultado em dois grupos:
  - **Seções sugeridas** (com checkbox para selecionar/desmarcar)
  - **Tarefas sugeridas** (como já funciona, agora mostrando a seção sugerida)
  - Lista de documentos que serão vinculados

- **Lógica de envio**: 
  - Se arquivo foi uploadado: converter para base64/texto e enviar para a nova action `create_from_file`
  - Se só texto: usar action `create_tasks` existente (com suporte a seções)

**4. Atualizar `ProjetoListView.tsx` — `handleCreateIATasks`**

Expandir para:
1. Primeiro criar seções novas selecionadas (aguardar IDs retornados)
2. Mapear tarefas para os IDs das seções (existentes + recém-criadas)
3. Criar tarefas
4. Upload dos documentos para storage e insert em `projeto_tarefa_documentos` vinculando às tarefas

**5. Atualizar `useProjetoIA.ts`**

Adicionar `createFromFile` que chama action `create_from_file` passando o conteúdo do arquivo + tipo de criação.

### Arquivos a Modificar

| Arquivo | Alteração |
|---|---|
| **Migration SQL** | Criar tabela `projeto_tarefa_documentos` + bucket `projeto-documentos` |
| `supabase/functions/projeto-ia-assistant/index.ts` | Nova action `create_from_file` com suporte multimodal |
| `src/components/projetos/CriarTarefasIADialog.tsx` | Checkboxes tipo, upload de arquivo/imagem, upload de documentos, review com seções + tarefas |
| `src/components/projetos/ProjetoListView.tsx` | Expandir `handleCreateIATasks` para criar seções + vincular documentos |
| `src/hooks/useProjetoIA.ts` | Adicionar `createFromFile` |

### Fluxo do Usuário

1. Abre "Criar com IA" → escolhe criar Seções, Tarefas ou ambos
2. Digita descrição OU sobe planilha/imagem → pode também anexar documentos
3. Clica "Gerar" → IA interpreta e sugere seções e/ou tarefas
4. Revisa, seleciona/desmarcar itens → clica "Criar"
5. Sistema cria seções, tarefas, e salva documentos vinculados automaticamente

