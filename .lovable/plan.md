
# Plano: Obrigar Cadastro de Fornecedor no Sistema

## Contexto

Na tela "Enviar para Pagamento" do módulo de Eventos (dialog `EnviarFinanceiroDialog.tsx`), o campo "Nome do Fornecedor" é atualmente um campo de texto livre. O usuário solicita que seja obrigatório **selecionar um fornecedor cadastrado no sistema**, seguindo o padrão de cadastro rápido já existente.

---

## Solução Proposta

Substituir o campo de texto por um **seletor de fornecedores** com as seguintes características:

1. **Dropdown com busca** - Lista de fornecedores da tabela `fabrica_fornecedores`
2. **Botão "+" para cadastro rápido** - Seguindo o padrão existente (`FornecedorQuickAdd`)
3. **Auto-preenchimento do CNPJ** - Quando selecionar um fornecedor, preencher automaticamente o campo CNPJ

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ENVIAR PARA PAGAMENTO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Fornecedor *                                         [+]  │  │
│  │ ┌─────────────────────────────────────────────────────┐   │  │
│  │ │ 🔍 Buscar fornecedor...                          ▼  │   │  │
│  │ └─────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  Opções (filtradas pela busca):                           │  │
│  │  ├─ Buffet Central Ltda - 12.345.678/0001-90             │  │
│  │  ├─ Gráfica ABC - 98.765.432/0001-00                     │  │
│  │  └─ Hotel Premium - 11.222.333/0001-44                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ CNPJ/CPF                                                   │  │
│  │ [ 12.345.678/0001-90 ] (preenchido automaticamente)       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modificações

### Arquivo: `src/components/events/EnviarFinanceiroDialog.tsx`

**Mudanças:**

| Campo Atual | Novo Campo |
|-------------|------------|
| `Input` texto livre para Nome do Fornecedor | `Combobox` com busca + lista de fornecedores |
| CNPJ manual | CNPJ auto-preenchido ao selecionar |

**Novo estado:**
- `fornecedores: Array` - Lista de fornecedores ativos do banco
- `fornecedorId: string` - ID do fornecedor selecionado
- `searchFornecedor: string` - Termo de busca

**Novo fluxo:**
1. Ao abrir o dialog, buscar fornecedores ativos de `fabrica_fornecedores`
2. Exibir combobox com busca (filtro por nome/CNPJ)
3. Ao selecionar, preencher `supplier_name` e `supplier_document`
4. Botão "+" abre popover para cadastro rápido (reutilizar `FornecedorQuickAdd`)

---

## Implementação Detalhada

### 1. Adicionar busca de fornecedores

```typescript
// Novo estado para fornecedores
const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
const [fornecedorId, setFornecedorId] = useState<string>("");
const [openCombobox, setOpenCombobox] = useState(false);

// Buscar ao abrir o dialog
useEffect(() => {
  if (open) {
    supabase
      .from("fabrica_fornecedores")
      .select("id, razao_social, cnpj")
      .eq("ativo", true)
      .order("razao_social")
      .then(({ data }) => setFornecedores(data || []));
  }
}, [open]);
```

### 2. Substituir Input por Combobox

Usar componentes `Popover` + `Command` (padrão shadcn/ui) para criar um seletor com busca:

- Exibir `razao_social` e `cnpj` em cada opção
- Filtrar por ambos os campos
- Ao selecionar, atualizar `formData.supplier_name` e `formData.supplier_document`

### 3. Integrar FornecedorQuickAdd

Adicionar botão "+" ao lado do seletor:

```typescript
<div className="flex gap-2">
  <Combobox ... />
  <FornecedorQuickAdd 
    onFornecedorCriado={(f) => {
      setFornecedores(prev => [...prev, { id: f.id, razao_social: f.nome, cnpj: null }]);
      setFornecedorId(f.id);
      setFormData({...formData, supplier_name: f.nome, supplier_document: ""});
    }} 
  />
</div>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/events/EnviarFinanceiroDialog.tsx` | Substituir Input por Combobox + integrar FornecedorQuickAdd |

---

## Benefícios

1. **Padronização** - Fornecedores ficam cadastrados no sistema para uso em outros módulos
2. **Integridade de dados** - Evita erros de digitação e duplicidade
3. **Rastreabilidade** - Pagamentos vinculados a fornecedores identificados
4. **Agilidade** - CNPJ preenchido automaticamente
5. **Flexibilidade** - Cadastro rápido caso o fornecedor não exista

---

## Validação

O botão "Enviar ao Financeiro" só será habilitado quando:
- ✅ Fornecedor selecionado (obrigatório)
- ✅ Tipo de documento preenchido
- ✅ Número do documento preenchido
- ✅ Data de vencimento preenchida
- ✅ Portador selecionado
