

# Plano: Filtrar Marcas e Criar Dashboard de Share por Marca

## Contexto

O usuário solicita duas alterações no módulo de Trade Marketing:

1. **Filtrar Marcas na Medição de Prateleira**: No formulário "Lançamento Rápido", exibir por padrão apenas as marcas **Melu** e **Ruby Rose**, com opção de adicionar outras marcas via botão "+"
2. **Dashboard de Share por Marca**: Criar uma tela de dashboard que mostre o share de prateleira de cada marca individualmente

---

## 1. Modificar BrandMeasurementSection

**Arquivo:** `src/components/fabrica/BrandMeasurementSection.tsx`

### Alterações:
- Mudar lógica de inicialização para mostrar apenas Melu e Ruby Rose por padrão (IDs conhecidos do banco)
- Adicionar botão "+" para incluir outras marcas disponíveis
- Criar dropdown/dialog para selecionar marcas adicionais
- Permitir remover marcas adicionadas (exceto as padrão)

### Estrutura de dados:
- IDs das marcas padrão (do banco):
  - Melu: `4fd4afcf-f280-4615-a73a-a227c59cb37e`
  - Ruby Rose: `a992f282-475b-4863-8c41-4061d3c24ddb`
- Outras disponíveis: Luluca, Nathalia Beauty

### Nova UI:
```text
┌─────────────────────────────────────────────┐
│ 🏷️ Medidas por Marca           [+ Adicionar]│
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 🏷️ Melu              Total: 120 cm     │ │
│ │ Largura: [60]  Prateleiras: [2]        │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 🏷️ Ruby Rose        Total: 80 cm   [X] │ │
│ │ Largura: [40]  Prateleiras: [2]        │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 2. Criar Dashboard de Share por Marca

### 2.1 Novo Hook: `useBrandShareDashboard.ts`

**Arquivo:** `src/hooks/useBrandShareDashboard.ts`

Responsável por:
- Buscar dados agregados de `shelf_measurement_brands` com join em `our_brands`
- Agrupar por marca e calcular share médio
- Calcular evolução mensal por marca (últimos 6 meses)
- Calcular ranking de marcas por share

### Queries principais:
```text
1. KPIs Gerais:
   - Total de medições
   - Share médio global
   - Marca líder em share
   - Crescimento vs. período anterior

2. Share por Marca (Gráfico de Pizza/Barras):
   - Soma de total_cm por brand_id
   - Cálculo de percentual

3. Evolução Mensal por Marca (Gráfico de Linhas):
   - Agrupar por mês e brand_id
   - Mostrar evolução do share de cada marca

4. Ranking de Lojas por Share:
   - Top 10 lojas com melhor share das nossas marcas
```

### 2.2 Novos Componentes do Dashboard

**Diretório:** `src/components/trade/brand-share/`

| Componente | Descrição |
|------------|-----------|
| `BrandShareKPIs.tsx` | Cards com KPIs principais (Total Medições, Share Médio, Marca Líder) |
| `BrandSharePieChart.tsx` | Gráfico de pizza mostrando distribuição de share por marca |
| `BrandShareEvolutionChart.tsx` | Gráfico de linhas com evolução mensal de cada marca |
| `BrandShareRankingTable.tsx` | Tabela com ranking de lojas por share |

### 2.3 Nova Página: `TradeBrandShareDashboard.tsx`

**Arquivo:** `src/pages/TradeBrandShareDashboard.tsx`

Estrutura similar ao `TradeExecutiveDashboard`:
- Header com título e filtros de data
- Seção de KPIs
- Grid com gráficos de distribuição e evolução
- Tabela de ranking

---

## 3. Adicionar Navegação

### 3.1 Nova Rota

**Arquivo:** `src/App.tsx`

```text
/dashboard/trade/brand-share → TradeBrandShareDashboard
```

### 3.2 Link no Menu de Trade

**Arquivo:** Sidebar ou página principal do Trade

Adicionar botão/link para "Dashboard de Marcas" na seção de Medições de Prateleira

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useBrandShareDashboard.ts` | Hook para dados do dashboard |
| `src/components/trade/brand-share/BrandShareKPIs.tsx` | KPIs principais |
| `src/components/trade/brand-share/BrandSharePieChart.tsx` | Gráfico de distribuição |
| `src/components/trade/brand-share/BrandShareEvolutionChart.tsx` | Evolução mensal |
| `src/components/trade/brand-share/BrandShareRankingTable.tsx` | Ranking de lojas |
| `src/pages/TradeBrandShareDashboard.tsx` | Página do dashboard |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/fabrica/BrandMeasurementSection.tsx` | Filtrar para Melu/Ruby Rose + botão adicionar |
| `src/App.tsx` | Nova rota `/dashboard/trade/brand-share` |
| `src/pages/TradeShelfMeasurements.tsx` | Botão para acessar dashboard de marcas |

---

## Fluxo do Usuário (Após Implementação)

```text
1. Lançamento Rápido:
   - Usuário vê apenas Melu e Ruby Rose por padrão
   - Clica "+" para adicionar Luluca ou Nathalia Beauty se necessário
   - Preenche medições e salva

2. Dashboard de Marcas:
   - Acessa via /dashboard/trade/brand-share ou botão em Medições
   - Visualiza KPIs: Total medições, Share médio, Marca líder
   - Analisa gráfico de pizza com distribuição por marca
   - Acompanha evolução mensal de cada marca
   - Consulta ranking de lojas por share
```

---

## Visualização do Dashboard

```text
┌─────────────────────────────────────────────────────────────────┐
│  📊 Dashboard de Share por Marca        [Filtro Data] [Atualizar]│
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Total   │  │  Share   │  │  Marca   │  │  +/- vs  │        │
│  │ Medições │  │  Médio   │  │  Líder   │  │ Anterior │        │
│  │    45    │  │  38.5%   │  │  Melu    │  │  +2.3%   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │  Distribuição Share │  │  Evolução Mensal                │   │
│  │     (Pie Chart)     │  │     (Line Chart)                │   │
│  │  [Melu: 45%]        │  │  Melu ───── Ruby Rose ─────     │   │
│  │  [Ruby Rose: 32%]   │  │                                 │   │
│  │  [Outros: 23%]      │  │  Set Out Nov Dez Jan Fev        │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  🏆 Ranking de Lojas por Share                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ #1 | Loja ABC         | 52.3%  | Melu: 30% | Ruby: 22.3%  ││
│  │ #2 | Loja XYZ         | 48.7%  | Melu: 28% | Ruby: 20.7%  ││
│  │ #3 | ...                                                   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

