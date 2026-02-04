

# Plano: Medição de Prateleiras por Marca

## Objetivo

Ajustar o formulário de **Lançamento Rápido** (medição de prateleiras) para permitir o registro de medidas **por marca**, incluindo a quantidade de prateleiras. O resultado será o cálculo: **Largura (cm) × Quantidade de Prateleiras**.

---

## Análise da Estrutura Atual

### Tabela `shelf_measurements` (atual)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| our_brands_width_cm | numeric | Largura total de "nossas marcas" |
| our_brands_facings | integer | Frentes totais de "nossas marcas" |

### Tabela `our_brands` (existente)
Já contém as marcas cadastradas:
- **Melu** (marca própria)
- **Ruby Rose** (marca principal)
- **Luluca** (by Melu)
- **Nathalia Beauty** (by Ruby Rose)

---

## Mudanças Necessárias

### 1. Nova Tabela: `shelf_measurement_brands`

Tabela de detalhamento por marca para cada medição:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| measurement_id | uuid | FK → shelf_measurements |
| brand_id | uuid | FK → our_brands |
| width_cm | numeric | Largura ocupada pela marca (cm) |
| shelf_count | integer | Quantidade de prateleiras |
| total_cm | numeric | Calculado: width_cm × shelf_count |
| facings | integer | Número de frentes (opcional) |
| created_at | timestamp | Data de criação |

### 2. Atualização da Tabela `shelf_measurements`

Adicionar campo para quantidade total de prateleiras:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| shelf_count | integer | Quantidade de prateleiras medidas |

---

## Interface do Usuário

### Formulário de Medição (QuickLaunchDialog)

O formulário atual será modificado para incluir:

```
┌──────────────────────────────────────────────────────────────┐
│  MEDIÇÃO DE PRATELEIRA                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Loja: [Drogaria XYZ        ▼]   Data: [04/02/2026]         │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ DIMENSÕES DA GÔNDOLA                                    │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ Largura Total (cm): [______]                            │ │
│  │ Qtd Prateleiras:    [______]                            │ │
│  │ Seção:              [Maquiagem___]                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ MEDIDAS POR MARCA                                       │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │                                                         │ │
│  │  🏷️ Melu                                                │ │
│  │  Largura (cm): [__60__]  Prateleiras: [__3__]          │ │
│  │  📊 Resultado: 180 cm                                   │ │
│  │                                                         │ │
│  │  🏷️ Ruby Rose                                           │ │
│  │  Largura (cm): [__80__]  Prateleiras: [__4__]          │ │
│  │  📊 Resultado: 320 cm                                   │ │
│  │                                                         │ │
│  │  🏷️ Luluca                                              │ │
│  │  Largura (cm): [__40__]  Prateleiras: [__2__]          │ │
│  │  📊 Resultado: 80 cm                                    │ │
│  │                                                         │ │
│  │  🏷️ Nathalia Beauty                                     │ │
│  │  Largura (cm): [__30__]  Prateleiras: [__2__]          │ │
│  │  📊 Resultado: 60 cm                                    │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ RESUMO                                                  │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ Total Nossas Marcas: 640 cm                             │ │
│  │ Share Total: 53.3%                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Cancelar]                              [Salvar Medição]   │
└──────────────────────────────────────────────────────────────┘
```

---

## Lógica de Cálculo

1. **Por Marca**: `total_cm = width_cm × shelf_count`
2. **Total Nossas Marcas**: Soma de todos os `total_cm` das marcas
3. **Share**: `(total_nossas_marcas / total_shelf_area) × 100`
   - Onde `total_shelf_area = total_shelf_width_cm × shelf_count`

---

## Arquivos a Modificar

### Banco de Dados (Migração SQL)

1. Criar tabela `shelf_measurement_brands`
2. Adicionar coluna `shelf_count` em `shelf_measurements`
3. Trigger para calcular `total_cm` automaticamente
4. RLS policies para a nova tabela

### Frontend

| Arquivo | Alteração |
|---------|-----------|
| `src/components/fabrica/QuickLaunchDialog.tsx` | Reformular seção de medição para listar marcas dinamicamente |
| `src/pages/TradeShelfMeasurements.tsx` | Exibir detalhamento por marca nos cards |
| `src/integrations/supabase/types.ts` | Será atualizado automaticamente |

---

## Comportamento Esperado

1. Ao abrir a seção de medição, carregar automaticamente todas as marcas ativas de `our_brands`
2. Usuário preenche largura e quantidade de prateleiras para cada marca presente
3. Sistema calcula automaticamente o resultado (Largura × Prateleiras)
4. Ao salvar:
   - Registro principal em `shelf_measurements` com totais consolidados
   - Registros detalhados em `shelf_measurement_brands` para cada marca preenchida
5. Na listagem/dashboard, mostrar breakdown por marca

---

## Considerações de Extensibilidade

- Novas marcas cadastradas em `our_brands` aparecerão automaticamente no formulário
- O campo `shelf_count` permite calcular a área total da gôndola
- Compatibilidade retroativa: medições antigas continuarão funcionando (campos novos são opcionais)

---

## Resumo de Entregáveis

1. **Migração SQL**: 1 nova tabela + 1 coluna nova + RLS + trigger
2. **QuickLaunchDialog.tsx**: Reformulação da seção de medição
3. **TradeShelfMeasurements.tsx**: Exibição do detalhamento por marca

