
# Plano: Sistema de Classificação Comercial de PDVs (A+, A, B, C, D, E)

## Entendimento do Requisito

Você quer classificar os PDVs por **potencial comercial/importância estratégica** usando a escala:
- **A+** → Cliente premium, maior potencial de faturamento
- **A** → Cliente muito importante
- **B** → Cliente importante
- **C** → Cliente médio
- **D** → Cliente pequeno
- **E** → Cliente inicial/baixo potencial

Esta classificação é diferente de:
- **Categoria** (tipo de loja: supermercado, farmácia, atacado)
- **Prioridade** (urgência de visita: alta, média, baixa)

## Opções de Implementação

| Opção | Abordagem | Prós | Contras |
|-------|-----------|------|---------|
| **1. Campo novo `classification`** | Criar coluna dedicada na tabela `stores` | Mais limpo, separado da prioridade | Requer migração e ajustes em UI |
| **2. Usar campo `priority`** | Alterar valores atuais (alta/média/baixa) para (A+/A/B/C/D/E) | Menos mudanças no banco | Perde conceito de urgência de visita |
| **3. Classificação calculada** | Baseada em faturamento, frequência de visitas, etc. | Automática | Complexo, precisa de histórico |

### Recomendação: Opção 1 - Campo Novo `classification`

Mantém a flexibilidade de ter tanto classificação comercial quanto prioridade de visita.

---

## Estrutura Proposta

### 1. Banco de Dados

Novo campo na tabela `stores`:

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `classification` | VARCHAR(2) | `C` | Classificação comercial: A+, A, B, C, D, E |

### 2. Interface Visual

Exibição da classificação com badges coloridos:

| Classificação | Cor | Descrição |
|---------------|-----|-----------|
| A+ | 🟣 Roxo/Dourado | Premium |
| A | 🔵 Azul | Muito importante |
| B | 🟢 Verde | Importante |
| C | 🟡 Amarelo | Médio |
| D | 🟠 Laranja | Pequeno |
| E | ⚪ Cinza | Baixo potencial |

### 3. Funcionalidades

- Seletor de classificação no cadastro e edição de PDV
- Badge visual na listagem de PDVs
- Filtro por classificação na tela de PDVs
- Ordenação por classificação
- Exibição no card mobile e detalhes

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Banco de Dados** | Adicionar coluna `classification` na tabela `stores` |
| `src/pages/TradeStores.tsx` | Exibir badge de classificação na listagem |
| `src/components/trade/NovaLojaDialog.tsx` | Adicionar seletor de classificação |
| `src/components/trade/EditarLojaDialog.tsx` | Adicionar seletor de classificação na edição |
| `src/components/trade/StoreDetailDialog.tsx` | Mostrar classificação nos detalhes |
| `src/components/trade/TradeFilters.tsx` | Adicionar filtro por classificação |
| `src/lib/validations/store.ts` | Incluir validação do campo classification |
| `src/hooks/useFilteredStores.ts` | Incluir classification nos campos retornados |

---

## Detalhes Técnicos

### Migration SQL

```sql
ALTER TABLE public.stores 
ADD COLUMN classification VARCHAR(2) DEFAULT 'C';

-- Índice para performance em filtros
CREATE INDEX idx_stores_classification ON public.stores(classification);

-- Comentário descritivo
COMMENT ON COLUMN public.stores.classification IS 
  'Classificação comercial do cliente: A+, A, B, C, D, E';
```

### Componente de Badge (exemplo)

```text
Mapeamento de cores:
┌────────────┬────────────────────────┐
│ Classificação │ Classe Tailwind       │
├────────────┼────────────────────────┤
│ A+         │ bg-purple-500          │
│ A          │ bg-blue-500            │
│ B          │ bg-green-500           │
│ C          │ bg-yellow-500          │
│ D          │ bg-orange-500          │
│ E          │ bg-gray-400            │
└────────────┴────────────────────────┘
```

### Seletor no Formulário

```text
┌─────────────────────────────────────┐
│ Classificação Comercial             │
│ ┌─────────────────────────────────┐ │
│ │ [A+] [A] [B] [C] [D] [E]        │ │
│ └─────────────────────────────────┘ │
│ Indica o potencial comercial do PDV │
└─────────────────────────────────────┘
```

---

## Fluxo de Uso

1. **Cadastro**: Ao criar PDV, seleciona classificação (default: C)
2. **Edição**: Pode alterar classificação a qualquer momento
3. **Listagem**: Badge colorido mostra classificação de cada PDV
4. **Filtros**: Pode filtrar por uma ou mais classificações
5. **Relatórios**: Permite análises por classificação

---

## Benefícios

1. **Segmentação**: Facilita priorizar visitas por potencial comercial
2. **Análise**: Relatórios por classificação de clientes
3. **Flexibilidade**: Independente de categoria e prioridade
4. **Visual**: Identificação rápida por cores
5. **Compatível**: Não afeta funcionalidades existentes
