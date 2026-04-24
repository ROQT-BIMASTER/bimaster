## KPIs Contextuais por Aba — Central de Trabalho (v3.4.2)

Eliminar a duplicação visual entre `CentralKPIs` (global) e `MinhasTarefasKPIs` (interno da aba "Tarefas") observada na captura: Pendentes / Atrasadas / Concluídas hoje apareciam duas vezes na mesma tela.

### Mudanças

**1. `src/components/projetos/central/CentralKPIs.tsx`** — refatorar
- Aceitar nova prop `activeTab: "hoje" | "tarefas" | "inbox"`.
- Calcular todas as métricas em um único `useMemo` (pendentes, hoje, atrasadas, concluídas hoje, produtividade semanal).
- Renderizar conjuntos distintos por aba:
  - **Hoje**: Para hoje · Atrasadas · Concluídas hoje · Não lidas
  - **Tarefas**: Pendentes · Atrasadas · Concluídas hoje · Produtividade semanal (cor por faixa: ≥70% success, ≥40% warning, senão destructive)
  - **Inbox**: Não lidas · Para hoje · Atrasadas · Pendentes
- Cards permanecem clicáveis quando há filtro destino (`onNavigate("tarefas", "hoje" | "atrasadas")`, `onNavigate("inbox")`).

**2. `src/components/projetos/central/MinhasTarefasContent.tsx`** — limpar
- Remover `<MinhasTarefasKPIs tarefas={tarefas} loading={isLoading} />` (linha 439) — fonte da duplicação.
- Remover import órfão `MinhasTarefasKPIs` (linha 43).
- Componente `MinhasTarefasKPIs.tsx` continua existindo no projeto (sem outros consumidores, mas não removo o arquivo agora).

**3. `src/pages/CentralTrabalho.tsx`** — propagar contexto
- Passar `activeTab={activeTab}` para `<CentralKPIs />` (linha 280).

**4. `src/lib/version.ts`** — bump
- `APP_VERSION` `3.4.1` → `3.4.2`.
- Entrada de changelog descrevendo a refatoração e a eliminação da duplicação.

### Resultado esperado
Apenas 4 KPIs por aba, todos relevantes ao contexto. Nenhuma métrica repetida verticalmente. A aba "Tarefas" troca "Não lidas" por "Produtividade semanal", mais útil para gestão da carga.