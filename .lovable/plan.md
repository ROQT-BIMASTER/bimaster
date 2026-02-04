
# Plano: Correção da Tela Visão Executiva Trade Marketing

## Problemas Identificados

### Problema 1: Query de Visitas Retornando Vazio
A query de visitas recentes usa um relacionamento inexistente:
```typescript
vendedor:profiles!visits_vendedor_id_fkey(nome)
```

Porém a tabela `visits` **NÃO possui** a foreign key `visits_vendedor_id_fkey`. As chaves estrangeiras existentes são:
- `visits_atribuido_por_fkey` (para profiles)
- `visits_store_id_fkey` (para stores)  
- `visits_user_id_fkey` (para auth.users)

Isso causa um erro silencioso que faz a query retornar vazio, mesmo havendo 5 visitas no banco de dados.

### Problema 2: Gráfico de Evolução Desatualizado
O gráfico de evolução mensal busca visitas por `scheduled_date` mas não atualiza em tempo real. Verificamos que existem:
- 17 fotos no banco
- 5 visitas no banco (mais recentes de jan/2026)

### Problema 3: Falta de Filtro de Data Global
Não existe filtro de período no dashboard executivo, dificultando análise histórica.

---

## Solução Proposta

### Arquivos a Modificar

1. **src/hooks/useTradeExecutiveDashboard.ts**
   - Corrigir query de visitas removendo join inválido com vendedor
   - Adicionar parâmetros de filtro de data (startDate, endDate)
   - Propagar filtro para todas as queries relevantes
   - Incluir queryKey com datas para invalidação correta

2. **src/pages/TradeExecutiveDashboard.tsx**
   - Adicionar estado para filtro de período
   - Adicionar componente de seleção de datas no header
   - Passar parâmetros de data para o hook

3. **src/components/trade/executive/TradeExecutiveVisitsTable.tsx** (sem alterações estruturais, apenas receberá dados corretos)

---

## Detalhes Técnicos

### Correção da Query de Visitas (useTradeExecutiveDashboard.ts)

**Antes (com erro):**
```typescript
const { data, error } = await supabase
  .from("visits")
  .select(`
    id, scheduled_date, duration_minutes, status, compliance_score,
    store:stores(name),
    vendedor:profiles!visits_vendedor_id_fkey(nome)  // FK INVÁLIDA
  `)
```

**Depois (corrigido):**
```typescript
const { data, error } = await supabase
  .from("visits")
  .select(`
    id, scheduled_date, duration_minutes, status, compliance_score,
    store:stores(name),
    atribuidor:profiles!visits_atribuido_por_fkey(nome)
  `)
```

Alternativamente, usar `user_id` com join manual se precisar do usuário que realizou a visita.

### Implementação do Filtro de Data

**Hook modificado:**
```typescript
export function useTradeExecutiveDashboard(dateRange?: { from: Date; to: Date }) {
  const today = new Date();
  const startDate = dateRange?.from || startOfMonth(today);
  const endDate = dateRange?.to || today;
  
  // Todas as queries usam startDate e endDate
}
```

**Componente de filtro (TradeExecutiveDashboard.tsx):**
- Adicionar Select com opções: "Este mês", "Últimos 30 dias", "Últimos 90 dias", "Este ano", "Personalizado"
- Para "Personalizado", mostrar DatePicker com range
- Posicionar ao lado do botão "Atualizar" no header

### Queries que Receberão Filtro de Data

1. **KPIs**: Contar visitas/fotos dentro do período selecionado
2. **Evolução Mensal**: Ajustar range de meses baseado no filtro
3. **Visitas Recentes**: Filtrar por `scheduled_date`
4. **Fotos Recentes**: Filtrar por `upload_date`
5. **Lançamentos**: Filtrar por `data_lancamento`

---

## Resultado Esperado

1. Tabela "Visitas Recentes" exibirá as 5 visitas existentes no banco
2. Gráfico de evolução mostrará dados corretos por mês
3. Usuário poderá filtrar todo o dashboard por período
4. Cache será invalidado corretamente quando período mudar
