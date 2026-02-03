
# Plano: Cadastrar Insumo Manual no Catálogo de Matérias-Primas

## Situação Atual

Quando o usuário adiciona um insumo no modo **Manual**:
1. O insumo é salvo apenas em `fabrica_produto_custos` 
2. O campo `mp_id` fica `null`
3. O insumo **não aparece** no cadastro de matérias-primas
4. Não pode ser reutilizado em outros produtos

## Solução Proposta

Adicionar uma opção (checkbox) para o usuário decidir se quer também cadastrar o insumo no catálogo de matérias-primas.

### Fluxo Proposto

```text
Modo Manual
    |
    v
Preenche código, nome, fornecedor, custos...
    |
    v
[x] Cadastrar também no catálogo de MPs (checkbox)
    |
    v
Clica "Adicionar"
    |
    +-- Se checkbox marcado:
    |       1. Cria registro em fabrica_materias_primas
    |       2. Usa o ID gerado como mp_id
    |       3. Cria registro em fabrica_produto_custos
    |
    +-- Se checkbox desmarcado:
            1. Cria apenas em fabrica_produto_custos (comportamento atual)
```

---

## Mudanças no Código

### Arquivo: AdicionarInsumoCustoDialog.tsx

1. Adicionar novo estado para checkbox
2. Ao salvar em modo manual com checkbox marcado:
   - Primeiro criar registro em `fabrica_materias_primas`
   - Usar o ID retornado para preencher `mp_id`
3. Passar o `mp_id` correto para `onAdicionar`

### Interface Atualizada

```text
+----------------------------------+
| Adicionar Insumo                 |
+----------------------------------+
| [Buscar MP]  [Manual ativo]      |
|                                  |
| Código *          Tipo de Insumo |
| [MP-001     ]     [Bulk      v]  |
|                                  |
| Nome *                           |
| [Nome do insumo              ]   |
|                                  |
| Fornecedor                   [+] |
| [Nome do fornecedor          ]   |
|                                  |
| [x] Cadastrar no catálogo de MPs | <-- NOVO
|                                  |
| -- Custos Detalhados ----------- |
| Custo NF    Custo Serv.   Cond.  |
| [0.00]      [0.00]        [0.00] |
|                                  |
| NF de Referência                 |
| [NF12345                     ]   |
|                                  |
|          [Cancelar] [Adicionar]  |
+----------------------------------+
```

---

## Detalhes da Implementação

### 1. Novo Estado

```typescript
const [cadastrarNoCatalogo, setCadastrarNoCatalogo] = useState(true);
```

### 2. Lógica de Salvamento

```typescript
const handleAdicionar = async () => {
  if (!codigo || !nome) return;

  let mpId: string | undefined = mpSelecionada?.id;

  // Se modo manual e checkbox marcado, criar no catálogo primeiro
  if (modo === "manual" && cadastrarNoCatalogo) {
    const { data: novaMP, error } = await supabase
      .from("fabrica_materias_primas")
      .insert({
        codigo: codigo.trim(),
        nome: nome.trim(),
        custo_unitario: parseFloat(custoNF) || 0,
        status: "ativo",
        fornecedor_id: null, // Podemos buscar pelo nome depois
      })
      .select("id")
      .single();

    if (error) {
      // Se erro de duplicidade, tentar buscar existente
      if (error.code === "23505") {
        toast.warning("Já existe uma MP com esse código");
      } else {
        toast.error("Erro ao cadastrar no catálogo");
      }
      return;
    }

    mpId = novaMP.id;
    toast.success("Insumo cadastrado no catálogo de MPs");
  }

  onAdicionar({
    mp_id: mpId,
    codigo,
    nome,
    // ... resto
  });
};
```

### 3. Checkbox na Interface

```tsx
{modo === "manual" && (
  <div className="flex items-center gap-2 py-2">
    <Checkbox
      id="cadastrarCatalogo"
      checked={cadastrarNoCatalogo}
      onCheckedChange={(checked) => setCadastrarNoCatalogo(!!checked)}
    />
    <Label htmlFor="cadastrarCatalogo" className="font-normal cursor-pointer">
      Cadastrar também no catálogo de matérias-primas
    </Label>
  </div>
)}
```

---

## Campos Necessários para fabrica_materias_primas

| Campo | Origem no Dialog | Observação |
|-------|------------------|------------|
| codigo | `codigo` | Obrigatório |
| nome | `nome` | Obrigatório |
| custo_unitario | `custoNF` | Custo NF como base |
| status | "ativo" | Fixo |
| fornecedor_id | - | Buscar pelo nome ou deixar null |
| unidade_medida_id | - | Pode ser opcional ou pedir |
| categoria_id | - | Pode usar tipo_insumo para inferir |

---

## Tratamento de Erros

1. **Código duplicado**: Avisar que já existe e sugerir buscar
2. **Fornecedor não encontrado**: Salvar sem vínculo (apenas texto)
3. **Campos obrigatórios faltando**: Já tratado pela validação existente

---

## Resultado Esperado

1. Checkbox "Cadastrar no catálogo de MPs" aparece apenas no modo Manual
2. Marcado por padrão para incentivar organização
3. Ao adicionar, cria registro em `fabrica_materias_primas`
4. O insumo fica vinculado (`mp_id` preenchido)
5. Pode ser reutilizado em outros produtos via busca
