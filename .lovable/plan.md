## Objetivo

Em **projetos genéricos**, ocultar todas as seções relacionadas a vínculo com produto acabado, China e documentos importados do "Vincular China". Essas seções continuam disponíveis somente em **projetos de produto** (e variações tipadas).

## Onde está o código

Tudo vive em `src/components/projetos/ProjetoTarefaDetalhe.tsx`. O componente já consulta o tipo do projeto via React Query:

```ts
// linhas 149-156 — já existe
const { data: projetoTipo } = useQuery({
  queryKey: ["projeto-tipo", projetoId],
  queryFn: async () => {
    const { data } = await supabase.from("projetos").select("tipo").eq("id", projetoId!).single();
    return (data?.tipo as string) || "generico";
  },
  enabled: !!projetoId,
});
```

Vamos usar `projetoTipo !== "generico"` (ou seja, `isProjetoProduto`) como gate visual para esconder os blocos.

## Mudanças

Criar uma constante logo abaixo da query:
```ts
const isProjetoProduto = projetoTipo && projetoTipo !== "generico";
```

Esconder os 3 blocos a seguir quando `!isProjetoProduto`:

1. **Bloco "Produto vinculado"** (linhas 583–696)
   - Atualmente o comentário diz "disponível em todos os tipos de projeto", mas conforme a regra agora ele só faz sentido em projeto de produto.
   - Envolver com `{isProjetoProduto && (…)}`.

2. **Widget "Produto China"** (linhas 709–717)
   - Ajustar a condição existente de `chinaVinculo &&` para `isProjetoProduto && chinaVinculo &&`.

3. **Seção "Documentos vindos do Vincular China"** (linhas 1094–1099)
   - Envolver `<Separator />` + `<TarefaChinaDocsSection />` com `{isProjetoProduto && (…)}` para evitar separator solto.

## Fora do escopo

- Não mexer em rotas, sidebar, menus de "Vincular China" / "Produtos Importados" (já restritos ao admin pela última alteração).
- Não mexer em RLS, banco, ou hooks. É apenas UI condicional dentro da gaveta de detalhe da tarefa.
- Não alterar a regra de "Enviar para Validação" (linha 185–195) — ela só roda quando o usuário tenta o fluxo de validação que pertence ao projeto de produto.

## Validação

- Abrir uma tarefa em **projeto genérico** → não deve renderizar Produto, Produto China nem Documentos do Vincular China.
- Abrir uma tarefa em **projeto de produto** (template `dev_produto` etc.) → segue exatamente como hoje.
