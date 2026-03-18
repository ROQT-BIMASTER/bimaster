

# Plano: Painel Administrativo de Despacho na Tela Vincular Envio China

## Visão Geral

Transformar a tela "Vincular Envio China" em um painel administrativo completo onde a funcionária no Brasil:
1. Recebe produtos e documentos da China (já tabulados pelo checklist)
2. Vincula produto ao projeto e documentos às tarefas
3. Numera cada documento como anexo formal (Anexo 01, Anexo 02...) por categoria do checklist
4. Despacha documentos individualmente para departamentos responsáveis
5. Cada departamento emite parecer (aprovar/rejeitar/pendência) com justificativa
6. Documentos aprovados podem ser devolvidos à China com status tabulado
7. O fluxo de etapas é configurável por tipo de documento (via Workflows Documentais)

## Implementação

### 1. Migração — Tabela `process_despacho_documento`
Registra cada despacho individual de documento (não mais só juntada):
- `id`, `submissao_id`, `documento_id` (FK china_produto_documentos), `processo_id`
- `numero_anexo` (int, auto-incrementado por submissão — "Anexo 01")
- `categoria_checklist` (key da categoria do doc)
- `departamento_destino_id`, `modulo_destino` (text)
- `status` (pendente / em_analise / aprovado / rejeitado / devolvido_china)
- `parecer_texto`, `parecer_por` (uuid), `parecer_por_nome`, `parecer_data`
- `devolvido_china` (bool), `devolvido_china_data`
- `workflow_config_id` (FK, opcional — link ao template de workflow)
- `etapa_atual` (int), `created_by`, `created_at`
- RLS: authenticated can all

### 2. Migração — Tabela `process_despacho_transicoes`
Histórico de ações em cada despacho:
- `id`, `despacho_id` (FK), `etapa_nome`, `acao` (despachar/aprovar/rejeitar/devolver_china/encaminhar)
- `usuario_id`, `usuario_nome`, `departamento_id`, `observacao`, `created_at`
- RLS: authenticated can all

### 3. Hook `useDespachoDocumentos`
- `useDespachosPorSubmissao(submissaoId)` — lista despachos com número de anexo
- `useCriarDespacho` — cria despacho com auto-numeração (max + 1 por submissão)
- `useRegistrarParecer` — registra aprovação/rejeição com justificativa
- `useDevolverChina` — marca como devolvido à China e atualiza status do doc original
- `useTransicoesDespacho` — histórico de transições

### 4. UI — Seção de Despacho dentro do card expandido (`ChinaSubmissaoExpandido`)
Ao expandir uma submissão, cada documento mostra:
- **Numeração**: "Anexo 01" / "Anexo 02" ao lado do nome, agrupado por categoria do checklist
- **Botão "Despachar"**: abre dialog para selecionar departamento destino e vincular a um workflow configurado
- **Badge de status**: pendente → em análise → aprovado/rejeitado → devolvido à China
- **Indicador visual**: cor de borda por status do despacho

### 5. UI — Painel de Despachos Ativos (nova seção abaixo dos cards de submissão)
Card colapsável "Despachos do Processo" mostrando:
- Lista de todos documentos despachados com: nº anexo, categoria, departamento, status, parecer
- Filtro por status (Pendente / Em Análise / Aprovado / Rejeitado)
- Ação "Devolver à China" para docs aprovados
- Mini-timeline de transições ao clicar em um despacho

### 6. UI — Dialog de Despacho de Documento
- Seleção de departamento destino (lista de departamentos do banco)
- Seleção opcional de workflow template (se existir para aquele tipo de documento)
- Campo de observação
- Preview do documento sendo despachado

### 7. UI — Dialog de Parecer (para o departamento que recebe)
- Ações: Aprovar / Rejeitar / Pendência / Encaminhar para outro departamento
- Campo obrigatório de justificativa em caso de rejeição
- Opção "Aprovar e Devolver à China" (atalho que aprova e marca devolução)

### 8. Integração com timeline do processo
- Cada despacho e parecer gera um `process_event` automaticamente
- Despachos devolvidos à China atualizam o `china_produto_documentos.status` para "aprovado"

### Arquivos
- **Criar**: migration SQL (2 tabelas), `src/hooks/useDespachoDocumentos.ts`, `src/components/processo/DespachoDocumentoDialog.tsx`, `src/components/processo/ParecerDialog.tsx`, `src/components/processo/DespachosPanel.tsx`
- **Editar**: `src/components/china/ChinaSubmissaoExpandido.tsx` (numeração de anexo + botão despachar + badge status), `src/pages/ProjetoVincularChina.tsx` (incluir DespachosPanel)

