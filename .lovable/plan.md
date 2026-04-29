# Cofre do Produto: corrigir botão X, garantir persistência e tornar fotos opcionais

## Diagnóstico

A tela mostrada vem de `CofreDoProdutoSection` dentro de
`src/components/china/ChinaDataValidationDialog.tsx` (linhas 750–950).
Os itens "Pedido China (Planilha Excel)", "Foto Produto Confirmado" e
"Foto Embalagem" estão hoje todos marcados como `obrigatorio=true` na tabela
`cofre_produto_config`.

### 1) Bug do "X vermelho" não funciona

O `<input type="file">` que abre o seletor de arquivos está posicionado como
overlay **cobrindo o card inteiro** (linhas 920–926):

```tsx
<input
  type="file"
  className="absolute inset-0 opacity-0 cursor-pointer"  // ← cobre tudo
  onChange={e => onPhotoUpload(key, e.target.files)}
/>
```

Isso captura o clique no botão X (linhas 906–912) **antes** dele chegar ao
`onRemovePhoto`. O usuário acha que está clicando em "remover" mas na verdade
abre o file picker. O `onClick` do botão nem dispara porque o input fica acima
no z-order.

### 2) Persistência

Já existe e funciona: ao clicar **Confirmar Dados** o diálogo chama
`onConfirm(finalData, photos)` (linha 286), e em
`src/pages/ChinaNovaSubmissao.tsx` (linhas 309–326) cada arquivo é enviado
para o bucket `china-documentos` e registrado em `china_produto_documentos`
com `status="pendente"`. A próxima etapa (Step 1, Checklist) lê esses
registros via `existingDocs`. Não há nada para reescrever, apenas garantir que
a remoção local (X) e o salvamento continuem coerentes.

### 3) Obrigatoriedade

Hoje no banco:
- Planilha Excel → obrigatório
- Foto Produto Confirmado → obrigatório
- Foto Embalagem → obrigatório

Pedido: deixar **apenas a Planilha Excel obrigatória**, fotos opcionais.

## Plano de implementação

### A. Corrigir o botão X (UI)

Em `src/components/china/ChinaDataValidationDialog.tsx`, no bloco
`CofreDoProdutoSection` (linhas ~888–934):

1. **Quando há arquivos**, NÃO renderizar mais o input cobrindo o card todo.
   Em vez disso:
   - O botão X de cada thumbnail funciona normalmente (sem overlay competindo).
   - Adicionar um pequeno botão "+ Adicionar mais" ao lado das thumbnails, que
     chama `inputRef.current?.click()` via `useRef` por slot.
2. **Quando NÃO há arquivos**, manter o overlay full-card como hoje (área
   grande clicável é desejável quando vazio).
3. Garantir que o botão X tem `e.stopPropagation()` para não vazar pro pai.

Pseudo-estrutura:

```tsx
const inputRef = useRef<HTMLInputElement>(null);
// ...
<div className="relative ..."> {/* card */}
  {fieldFiles.length > 0 ? (
    <>
      <div className="flex flex-wrap gap-1 w-full">
        {/* thumbnails com X funcional */}
      </div>
      <button type="button" onClick={() => inputRef.current?.click()}>
        + Adicionar mais
      </button>
    </>
  ) : (
    <>
      {getTipoIcon(...)}
      {/* overlay clicável em toda área SÓ quando vazio */}
      <input ref={inputRef} type="file" className="absolute inset-0 opacity-0 cursor-pointer" ... />
    </>
  )}
  {/* input controlado por ref para "+ Adicionar mais" — fora do overlay */}
  <input ref={inputRef} type="file" className="hidden" ... />
</div>
```

(Refatorar para um único `inputRef` por slot, controlado por ref.)

### B. Tornar fotos opcionais (banco)

Migration única:

```sql
UPDATE public.cofre_produto_config
SET obrigatorio = false
WHERE id IN (
  '724bd521-851f-4188-aa2a-584bb308e491', -- Foto Produto Confirmado
  '63c0b05b-dadf-4984-b8d1-41507d01e2cb'  -- Foto Embalagem
);
-- Planilha Excel (28ae005d-...) permanece obrigatório
```

Resultado:
- Planilha Excel continua obrigatória (badge vermelho 🔴 e bloqueio de
  confirmação se faltar).
- Fotos viram opcionais (badge cinza ⚪), confirmação não bloqueia mais
  por ausência delas.

### C. Persistência (já garantida)

Sem mudança. O fluxo `onConfirm → upload → insert china_produto_documentos`
permanece. Só validar visualmente que após:
1. Adicionar planilha + 2 fotos.
2. Remover 1 foto (X agora funcional).
3. Confirmar.

→ no Step 1 aparecem exatamente: planilha + 1 foto, com `status="pendente"`,
e na tabela `china_produto_documentos` o mesmo registro.

## Arquivos afetados

- `src/components/china/ChinaDataValidationDialog.tsx` — refator do bloco de
  thumbnails / input de upload (sem mudar API do componente, só o JSX interno
  do `CofreDoProdutoSection`).
- Migration: `UPDATE cofre_produto_config SET obrigatorio = false WHERE id IN (...)`.

Nada mais é tocado: o handler de remoção (`removePhoto`), a persistência em
`ChinaNovaSubmissao.tsx` e a leitura no Step 1 já estão corretos.

## Validação manual

1. Abrir o diálogo de validação com planilha + 2 fotos.
2. Clicar no X vermelho de uma das fotos → ela some imediatamente do card,
   sem abrir o file picker.
3. Clicar no card vazio (ou "+ Adicionar mais") → file picker abre normalmente.
4. Card "Foto Produto Confirmado" e "Foto Embalagem" aparecem com pílula
   ⚪ "Opcional"; só "Pedido China (Planilha Excel)" mantém 🔴.
5. Confirmar sem fotos → salva com sucesso (apenas a planilha é exigida).
6. No Step 1, a planilha aparece registrada como documento pendente.
