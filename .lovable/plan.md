
# Plano: Consulta de CNPJ Gratuita via OpenCNPJ

## Objetivo
Adicionar funcionalidade opcional de consulta de CNPJ usando a API gratuita OpenCNPJ nos formulários de cadastro manual de:
- Lojas/PDVs (Nova Loja)
- Fornecedores (FornecedorQuickAdd e formulários completos)
- Clientes
- Distribuidoras (NovaDistribuidoraDialog)

## Arquitetura da Solução

### 1. Criar Edge Function para Consulta OpenCNPJ

**Arquivo:** `supabase/functions/opencnpj-consulta/index.ts`

A edge function servirá como proxy para a API OpenCNPJ, oferecendo:
- Validação de CNPJ antes da consulta
- Tratamento de erros padronizado
- Cache de resultados (para economia de chamadas)
- Proteção de autenticação

**Endpoint da API:** `GET https://api.opencnpj.org/{CNPJ}`

**Campos retornados:**
| Campo API | Campo Formulário |
|-----------|-----------------|
| `razao_social` | Nome/Razão Social |
| `nome_fantasia` | Nome Fantasia/Rede |
| `logradouro`, `numero`, `complemento` | Endereço |
| `municipio` | Cidade |
| `uf` | Estado/UF |
| `telefone_1` | Telefone |
| `email` | Email |
| `cep` | CEP |

### 2. Criar Componente Reutilizável

**Arquivo:** `src/components/shared/CnpjSearchButton.tsx`

Botão reutilizável que:
- Recebe o CNPJ atual como prop
- Exibe loading durante a consulta
- Retorna os dados via callback `onDataFound`
- Mostra toast de sucesso/erro

```text
┌─────────────────────────────────────────────┐
│  CNPJ: [00.000.000/0000-00    ] [🔍]       │
│                                 └─ botão    │
└─────────────────────────────────────────────┘
```

### 3. Integrar nos Formulários

#### 3.1 Nova Loja/PDV
**Arquivo:** `src/components/trade/NovaLojaDialog.tsx`
- Adicionar botão de busca ao lado do campo CNPJ
- Preencher: nome, endereço, cidade, UF, telefone

#### 3.2 Fornecedores (Quick Add)
**Arquivo:** `src/components/fabrica/FornecedorQuickAdd.tsx`
- Adicionar botão de busca na aba "Básico"
- Preencher: nome/razão social, CNPJ formatado

#### 3.3 Nova Distribuidora
**Arquivo:** `src/components/estoque/NovaDistribuidoraDialog.tsx`
- Adicionar botão de busca ao lado do campo CNPJ
- Preencher: nome, endereço, cidade, UF, telefone, email

#### 3.4 Cadastro de Clientes
**Arquivo:** A ser identificado (formulário de novo cliente)
- Mesmo padrão dos demais formulários

## Detalhes Técnicos

### Edge Function - opencnpj-consulta

```typescript
// Estrutura básica
serve(async (req) => {
  // 1. Verificar autenticação
  // 2. Validar CNPJ (14 dígitos)
  // 3. Verificar cache (tabela opencnpj_cache)
  // 4. Chamar API OpenCNPJ
  // 5. Salvar no cache
  // 6. Retornar dados formatados
});
```

### Tabela de Cache (opcional)

```sql
CREATE TABLE IF NOT EXISTS opencnpj_cache (
  cnpj TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);
```

### Componente CnpjSearchButton

```typescript
interface CnpjSearchButtonProps {
  cnpj: string;
  onDataFound: (data: CnpjData) => void;
  disabled?: boolean;
}

interface CnpjData {
  razaoSocial?: string;
  nomeFantasia?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  email?: string;
  cep?: string;
}
```

### Fluxo de Uso

```text
Usuário digita CNPJ
        │
        ▼
Clica no botão 🔍
        │
        ▼
┌───────────────────┐
│ Valida 14 dígitos │
└───────────────────┘
        │
        ▼ (válido)
┌───────────────────┐
│ Chama Edge Func   │
│ opencnpj-consulta │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Preenche campos   │
│ automaticamente   │
└───────────────────┘
        │
        ▼
Toast: "Dados carregados!"
```

## Arquivos a Serem Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/opencnpj-consulta/index.ts` | Criar |
| `src/components/shared/CnpjSearchButton.tsx` | Criar |
| `src/components/trade/NovaLojaDialog.tsx` | Modificar |
| `src/components/fabrica/FornecedorQuickAdd.tsx` | Modificar |
| `src/components/estoque/NovaDistribuidoraDialog.tsx` | Modificar |
| Formulário de cadastro de clientes | Modificar |

## Vantagens do OpenCNPJ

- **100% Gratuito**: Sem custos de API
- **Sem API Key**: Não precisa cadastro
- **Dados da Receita Federal**: Dados oficiais atualizados
- **Simples**: GET request direto

## Considerações

1. **Rate Limiting**: A API pode ter limites de requisições. A edge function pode implementar throttling se necessário.

2. **Disponibilidade**: APIs gratuitas podem ficar fora do ar. O sistema continuará funcionando normalmente sem a consulta.

3. **Fallback**: Se OpenCNPJ falhar, podemos implementar fallback para CNPJ.BIZ (já configurado no projeto).

4. **UX**: O botão de busca é opcional - usuário pode preencher manualmente se preferir.
