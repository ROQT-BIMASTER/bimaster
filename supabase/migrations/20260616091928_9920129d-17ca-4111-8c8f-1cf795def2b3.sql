ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS data_proxima_acao DATE;

COMMENT ON COLUMN public.projeto_tarefas.data_proxima_acao IS
  'Data da próxima ação prevista para a tarefa. Tipo DATE (sem fuso); UI deve usar parseLocalDate/formatLocalDate para evitar shift UTC em America/Sao_Paulo.';