

# Plano: Juntada Oficial de Documentos ao Processo + Subprocesso Documental

## Conceito

Dois recursos interligados:

1. **Juntada Oficial** — Qualquer usuário, do seu módulo, pode "juntar" documentos oficiais ao processo do produto (como "Junto às fls. 35-36 embalagens como Docs Oficiais"), registrando autoria, data e parecer formal na timeline do processo.

2. **Subprocesso Documental** — Cada documento juntado pode ter seu próprio mini-workflow configurável entre departamentos (ex: Arte cria → Regulatório revisa → aprovado/reprovado), com alçadas e encaminhamentos.

## Implementação

### 1. Tabela `process_juntadas`
Registra cada juntada oficial ao processo:
- `id`, `process_id` (FK → product_process), `documento_titulo`, `documento_url`, `documento_path`
- `folhas` (ex: "35-36"), `tipo_documento` (embalagem, rótulo, etc.)
- `parecer` (texto livre do usuário), `parecer_status` (aprovado/pendencia/rejeitado)
- `juntado_por`, `juntado_por_nome`, `departamento_id`
- `created_at`

### 2. Tabela `process_doc_workflow_config`
Templates de subprocesso por tipo de documento:
- `id`, `tipo_documento`, `nome`, `ativo`
- Etapas na tabela filha `process_doc_workflow_etapas`: `config_id`, `nome`, `departamento_responsavel_id`, `ordem`, `tipo_acao` (criar/revisar/aprovar)

### 3. Tabela `process_doc_workflow_instancias`
Instância de subprocesso vinculada a uma juntada:
- `id`, `juntada_id` (FK), `config_id` (FK), `etapa_atual`, `status` (em_andamento/concluido/rejeitado)

### 4. Tabela `process_doc_workflow_transicoes`
Histórico de ações no subprocesso:
- `id`, `instancia_id`, `etapa_nome`, `acao` (aprovar/rejeitar/encaminhar), `usuario_id`, `usuario_nome`, `observacao`, `created_at`

### 5. UI — Botão "Juntar Documento" na Consulta de Processos
- Na página `ConsultaProcessos.tsx`, adicionar seção **"Juntadas / Documentos Oficiais"** com:
  - Botão "Juntar Documento ao Processo" → dialog com upload, seleção de tipo, folhas, parecer
  - Lista de juntadas com status do subprocesso
  - Cada juntada mostra mini-timeline do workflow (Arte → Regulatório → ✅)

### 6. UI — Painel do Subprocesso Documental
- Ao clicar numa juntada, abre drawer com:
  - Etapas do workflow e status atual
  - Botões de ação conforme departamento do usuário (Aprovar / Rejeitar / Encaminhar)
  - Timeline de transições

### 7. Página de Config — `ConfigDocWorkflows.tsx`
- Acessível via Sidebar (Processos → Workflows Documentais)
- CRUD de templates: definir etapas, departamentos responsáveis e ordem
- Rota: `/dashboard/processos/workflows`

### 8. Integração com `process_events`
- Cada juntada e transição de subprocesso gera um `process_event` automaticamente na timeline unificada do produto

### Arquivos
- **Criar**: migration SQL (4 tabelas), `src/hooks/useProcessJuntadas.ts`, `src/hooks/useDocWorkflow.ts`, `src/pages/ConfigDocWorkflows.tsx`
- **Editar**: `src/pages/ConsultaProcessos.tsx` (seção juntadas), `src/App.tsx` (rota), `src/components/dashboard/AppSidebar.tsx` (menu)

