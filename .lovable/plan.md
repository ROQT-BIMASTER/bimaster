## v3.4.27 (PR-63) — Filtros adicionais no Diagnóstico de Tarefas sem `data_conclusao`

### Objetivo
Permitir isolar casos recorrentes/específicos no painel `DiagnosticoTarefasDataConclusao` cruzando:
- **Status atual** da tarefa (multi-select: `concluida`, `em_andamento`, `pendente`).
- **Intervalo de `data_conclusao`** (par De/Até dedicado), **mantendo** o filtro existente por `updated_at`.

> Observação técnica: não existe tabela de histórico de transições para `projeto_tarefas` (apenas `projeto_tarefas_backfill_log` e `projeto_tarefas_consistency_check_log`). Portanto "status anterior" não é viável sem criar nova infraestrutura — fora do escopo desta PR. Aqui filtramos apenas pelo **status atual**, conforme escolha do usuário.

---

### Backend (migração SQL)

**Arquivo:** `supabase/migrations/<timestamp>_diag_tarefas_filtros_status_dataconclusao.sql`

Estender as duas RPCs existentes preservando a assinatura antiga via parâmetros nomeados com defaults (compatibilidade total com chamadas atuais):

```sql
-- Versão estendida: status[] + janela de data_conclusao
CREATE OR REPLACE FUNCTION public.diag_tarefas_sem_data_conclusao_resumo(
  p_date_from timestamptz DEFAULT NULL,           -- updated_at >=
  p_date_to   timestamptz DEFAULT NULL,           -- updated_at <=
  p_status    text[]      DEFAULT ARRAY['concluida'],  -- status atual
  p_conclusao_from date    DEFAULT NULL,          -- data_conclusao >=
  p_conclusao_to   date    DEFAULT NULL           -- data_conclusao <=
) RETURNS TABLE (...)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- valida admin (mesma checagem atual via has_role)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT pt.*
    FROM projeto_tarefas pt
    WHERE (p_date_from IS NULL OR pt.updated_at >= p_date_from)
      AND (p_date_to   IS NULL OR pt.updated_at <= p_date_to)
      AND (p_status IS NULL OR cardinality(p_status) = 0 OR pt.status = ANY(p_status))
      AND (p_conclusao_from IS NULL OR pt.data_conclusao >= p_conclusao_from)
      AND (p_conclusao_to   IS NULL OR pt.data_conclusao <= p_conclusao_to)
  )
  SELECT
    COUNT(*) FILTER (WHERE status = 'concluida')::int                                  AS total_concluidas,
    COUNT(*) FILTER (WHERE status = 'concluida' AND data_conclusao IS NULL)::int       AS sem_data_conclusao,
    COUNT(*) FILTER (WHERE status = 'concluida' AND data_conclusao IS NOT NULL)::int   AS com_data_conclusao,
    -- pct_sem_data, responsaveis_afetados, último backfill (mesma lógica atual) ...
  FROM base;
END $$;
```

E o equivalente para `diag_tarefas_sem_data_conclusao` (detalhe por responsável), aplicando os mesmos cinco filtros no `WHERE`.

**Notas:**
- Defaults garantem que chamadas antigas (apenas `p_date_from` + `p_date_to`) continuem funcionando sem alteração de comportamento — `p_status` default `{concluida}` reproduz o escopo atual.
- Quando `p_status` inclui status diferente de `concluida`, `sem_data_conclusao` continua significando "concluídas sem data" (definição da métrica), apenas o universo de contagem muda.
- Sem alterações no `backfill_data_conclusao_tarefas` nem em RLS.
- `GRANT EXECUTE ... TO authenticated` mantido.

---

### Frontend

**Arquivo:** `src/pages/admin/DiagnosticoTarefasDataConclusao.tsx`

1. **Novo estado:**
   ```tsx
   const STATUS_OPTIONS = ['concluida','em_andamento','pendente'] as const;
   const [statusSel, setStatusSel] = useState<string[]>(['concluida']);
   const [conclFrom, setConclFrom] = useState<Date | undefined>();
   const [conclTo, setConclTo] = useState<Date | undefined>();
   ```

2. **`filterArgs`** estendido para incluir `p_status`, `p_conclusao_from` (formato `yyyy-MM-dd`) e `p_conclusao_to`. Query keys atualizadas para refazer fetch quando qualquer filtro muda.

3. **UI — barra de filtros adicional** logo abaixo do header (mantém o `DateRangeFilter` atual, rotulado como "Atualizadas em"):
   - Componente novo `StatusMultiSelectFilter` baseado em `Popover` + `Checkbox` (padrão visual idêntico ao `DateRangeFilter`: `h-9 text-xs`, ícone `Filter`, contador "Status: 2"). Reutiliza `Badge` para chips selecionados.
   - Segundo `DateRangeFilter` etiquetado "Concluídas em" (`conclFrom`/`conclTo`), com mesmo estilo compacto.
   - Botão "Limpar filtros" ao lado quando algum filtro estiver ativo (status ≠ `['concluida']`, datas presentes).

4. **Card "Detalhamento por responsável":** acrescentar texto secundário no `CardDescription` indicando os filtros aplicados (ex.: "Status: concluída, em andamento · Concluídas entre 01/04 e 24/04").

5. **Empty state:** atualizar mensagem para sugerir "Limpar filtros" quando combinação não retornar registros.

6. **Memo `hasExtraFilters`** controla visibilidade do botão "Limpar".

Nenhuma mudança em `src/components/shared/DateRangeFilter.tsx` (já genérico). O novo `StatusMultiSelectFilter` fica como componente local no mesmo arquivo da página (uso restrito ao diagnóstico), seguindo o padrão de `ProjetoHomeFilters`.

---

### Versionamento e changelog

**Arquivo:** `src/lib/version.ts`
- `APP_VERSION` → `'3.4.27'`
- Nova entrada no changelog interno descrevendo a PR-63 (filtros de status atual + janela de `data_conclusao`).

Conforme `mem://process/release-changelog-discipline`: a entrada precisa ser grep-verificável (positivo/negativo/versão) e referenciada em `ApiDocumentation.tsx` se aplicável (verificar se há seção sobre as RPCs `diag_*`; se sim, atualizar com os novos parâmetros opcionais).

---

### Arquivos afetados

- **Novo:** `supabase/migrations/<ts>_diag_tarefas_filtros_status_dataconclusao.sql`
- **Editado:** `src/pages/admin/DiagnosticoTarefasDataConclusao.tsx`
- **Editado:** `src/lib/version.ts`
- **Auto-regenerado:** `src/integrations/supabase/types.ts`
- **Possivelmente editado:** `src/pages/api/ApiDocumentation.tsx` (se documenta as RPCs)

---

### Fora do escopo (registrado para futuras iterações)

- Histórico de transições de status (`projeto_tarefas_status_history` + trigger) — necessário para filtro real de "status anterior → atual" e detecção de reabertura. Pode ser proposto em PR separada.
- Cruzamento com `projeto_tarefas_backfill_log` para listar tarefas que ficaram órfãs mais de uma vez (caso recorrente "puro"). Fica para PR-64 caso o usuário queira essa visão dedicada.
