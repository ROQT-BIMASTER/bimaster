

## Plano: Persistir XMLs de NF-e para reutilização entre produtos

Atualmente o XML é processado em memória e descartado após vincular. O objetivo é salvar o arquivo XML e seus dados parseados no banco, permitindo que ao vincular um insumo em qualquer produto, o usuário possa escolher entre **subir um novo XML** ou **selecionar um já salvo**.

---

### 1. Criar tabela `fabrica_nfe_xmls` e bucket de storage

**Tabela** para armazenar metadados dos XMLs já importados:
- `id` (uuid, PK)
- `numero_nf` (text) — número da NF
- `serie` (text)
- `chave_acesso` (text, unique)
- `data_emissao` (date)
- `valor_total` (numeric)
- `fornecedor_cnpj` (text)
- `fornecedor_razao_social` (text)
- `fornecedor_nome_fantasia` (text)
- `produtos` (jsonb) — array com os produtos parseados do XML
- `storage_path` (text) — caminho do XML no storage
- `uploaded_by` (uuid, FK profiles)
- `created_at` (timestamptz)

**Storage bucket** `fabrica-nfe-xmls` para guardar o arquivo XML original.

**RLS**: usuários autenticados podem ler todos e inserir.

### 2. Atualizar `VincularXmlInsumoDialog`

Adicionar **duas abas/modos** no dialog:
- **Subir novo XML**: fluxo atual, mas ao processar o XML com sucesso, salva o arquivo no storage e os metadados na tabela antes de apresentar os produtos.
- **Selecionar XML salvo**: lista os XMLs já importados (número NF, fornecedor, data), ao selecionar carrega os produtos do campo `jsonb` para a mesma tabela de seleção.

Antes de salvar um novo XML, verificar pela `chave_acesso` se já existe — se sim, reutilizar o registro existente.

### 3. Ajustar fluxo de vinculação

O restante do fluxo (selecionar produto, preencher fornecedor/custo/NF/código) permanece idêntico. A única diferença é a origem dos dados: memória local vs. banco.

---

### Detalhes técnicos

```text
┌──────────────────────────────────────┐
│  VincularXmlInsumoDialog             │
│                                      │
│  [Subir novo XML]  [XMLs salvos]     │
│  ─────────────────────────────────── │
│  Tab 1: Upload → parse → save DB     │
│  Tab 2: Lista XMLs → select → load   │
│  ─────────────────────────────────── │
│  Tabela de produtos do XML           │
│  [Vincular Produto]                  │
└──────────────────────────────────────┘
```

**Arquivos afetados:**
- Migration SQL (nova tabela + bucket + RLS)
- `src/components/fabrica/VincularXmlInsumoDialog.tsx` — adicionar abas, lógica de salvar e buscar XMLs
- `src/lib/fabrica/nfe-xml-parser.ts` — sem alterações

