## Problema

Hoje o "gerar_relatorio" do copiloto sempre produz **o mesmo PDF**:
- 3 tipos fixos (`status` | `responsaveis` | `executivo`), cada um renderizando seções idênticas hard-coded em `pdf-lib`.
- Ignora o **prompt do usuário** ("quero um PDF só das tarefas atrasadas do João", "compare prazos previstos vs reais", "resumo da pasta de processos", etc.).
- Não consulta **documentos do cofre/anexos** ao montar o PDF.
- Sem capacidade de variar seções, tabelas, gráficos ou narrativa.

## Solução: Relatórios dinâmicos guiados por IA

Substituir o template fixo por um **pipeline IA → Spec → Render**:

1. **IA cria a "spec" do relatório** (JSON estruturado) a partir do pedido em linguagem natural + dados do projeto + documentos relevantes.
2. **Renderer genérico** (pdf-lib) consome a spec e desenha qualquer combinação de blocos: capa, parágrafos narrativos, KPIs, tabelas arbitrárias, gráficos (barra/linha/pizza), listas, citações de documentos do cofre.
3. **XLSX** análogo: a spec define abas e colunas dinamicamente.

### Fluxo novo

```text
chat: "PDF só das tarefas atrasadas do João, com prazo original vs replanejado"
   │
   ▼
projeto-copilot (tool gerar_relatorio)
   │ args agora: { formato, prompt, escopo? }
   ▼
projeto-copilot-relatorio
   1. Carrega contexto amplo (tarefas, equipe, marcos, anexos do cofre/processos)
   2. Chama Lovable AI (gpt-5.2 c/ tool calling) → devolve ReportSpec JSON
   3. Renderer pdf-lib percorre spec.blocks[] e desenha
   4. Sobe no bucket + signed URL (igual hoje)
```

### ReportSpec (contrato)

```ts
type ReportSpec = {
  titulo: string;
  subtitulo?: string;
  resumo_executivo?: string;       // markdown curto
  blocks: Block[];
};
type Block =
  | { kind: "heading"; level: 1|2|3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "kpis"; items: { label: string; value: string|number; hint?: string }[] }
  | { kind: "table"; columns: string[]; rows: (string|number)[][]; caption?: string }
  | { kind: "bar_chart"; title: string; series: { label: string; value: number; color?: string }[] }
  | { kind: "pie_chart"; title: string; series: { label: string; value: number }[] }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "callout"; tone: "info"|"warn"|"success"|"danger"; text: string }
  | { kind: "document_ref"; nome: string; trecho: string };  // citações do cofre
  | { kind: "page_break" };
```

A IA escolhe livremente **quais blocos**, **quantos**, **em que ordem** — daí "infinitas possibilidades".

### Acesso a documentos

Durante a montagem da spec, a função:
- Lista anexos do projeto (`projeto_anexos`, cofre oficial).
- Se o prompt indicar análise documental, baixa e extrai texto (PDF via `pdfjs-serverless`, igual ao já usado no `projeto-copilot/index.ts`).
- Passa trechos relevantes para a IA citar via `document_ref`.

### Mudanças em arquivos

**Edge functions**
- `supabase/functions/projeto-copilot-relatorio/index.ts` — reescrita:
  - Schema de body: aceita `prompt: string` (obrigatório quando ausente os 3 tipos legados) e mantém `tipo` opcional para compat.
  - Novo módulo interno `buildSpec()` que monta contexto + chama AI Gateway.
  - Novo módulo `renderPdf(spec)` e `renderXlsx(spec)` genéricos.
- `supabase/functions/projeto-copilot/index.ts` — tool `gerar_relatorio`:
  - Nova assinatura: `{ formato: "pdf"|"xlsx", prompt: string, incluir_documentos?: boolean }`.
  - Description orientando a IA a sempre passar o pedido literal do usuário em `prompt`.

**Frontend**
- `src/components/projetos/ProjetoCopilotPanel.tsx`:
  - Sugestões rápidas viram exemplos variados ("PDF de atrasos por responsável", "Planilha de marcos do trimestre", "Resumo executivo com riscos", "Análise dos PDFs do cofre").
  - Tooltip do card de relatório mostra o prompt original.

**Sem migração de schema** — `projeto_copilot_relatorios` já tem `metadata jsonb` para guardar a spec.

### Garantias

- Fallback: se a IA falhar/retornar spec inválida, cai no template antigo (`status` executivo) para não quebrar o chat.
- Limite de páginas e blocos por spec (anti-runaway).
- Reaproveita `callAIGateway` do `_shared/ai-gateway-call.ts` (já corrigido para gpt-5.2).
- Mantém RLS via `user_can_access_projeto`.

### QA

1. Deploy → curl com 3 prompts distintos no mesmo projeto e confirmar **PDFs visualmente diferentes**.
2. Converter PDFs em imagens (`pdftoppm`) e inspecionar no `/tmp` (não copia para `/mnt/documents`).
3. Validar XLSX abre no LibreOffice headless.

## Fora de escopo

- Gráficos avançados (linha multi-série, scatter) — só barra e pizza nesta iteração.
- Imagens embutidas (logo, screenshots) — fica para próxima.
- Editor manual da spec no front.
