# Correção do travamento/loop após edição do card "Displays / Master"

## Diagnóstico

O sintoma ("tela trava/pisca em todo o sistema") surgiu logo após as últimas alterações no `ChinaDataValidationDialog`. A causa não está no JSX do card novo, mas no `useEffect` de inicialização do diálogo, combinado com o jeito que ele é usado:

**Arquivo:** `src/components/china/ChinaDataValidationDialog.tsx` (linhas 80–88)

```tsx
useEffect(() => {
  if (open) {
    setData({ ...initialData });
    setCores(initialData.cores?.length ? [...initialData.cores] : []);
    setAccepted(false);
    setPhotos({});
    setPhotoPreviews({});
  }
}, [open, initialData]);   // ← initialData é um objeto novo a cada render do pai
```

**Arquivo:** `src/components/china/ChinaExcelPreview.tsx` (linha 212) e `src/pages/ChinaNovaSubmissao.tsx` (linha 1200) passam `initialData={data}` / `initialData={pendingAiData}` — referências que mudam a cada render do pai.

### Por que trava tudo

1. Pai renderiza → cria novo `initialData` (mesmo conteúdo, referência diferente).
2. `useEffect` dispara porque a dep `initialData` "mudou" → chama 5 `setState` no diálogo.
3. Esses `setState` fazem o pai re-renderizar (via callbacks/contextos compartilhados, React Query, etc.).
4. Volta ao passo 1 → loop infinito de renders.
5. O loop satura o thread principal → toda a aplicação (sidebar, navegação, qualquer rota) fica travando/piscando, mesmo em telas que não abrem o diálogo, porque o componente fica montado na árvore enquanto o usuário navega.

Isso explica perfeitamente "trava/pisca ao interagir em todas as telas após as últimas mudanças".

## Plano de correção

Mudança mínima e cirúrgica, só no diálogo:

1. **Remover `initialData` da lista de dependências** do `useEffect` em `ChinaDataValidationDialog.tsx`. A intenção do efeito é resetar o estado **quando o diálogo abre**, não toda vez que o pai re-renderiza.

   ```tsx
   useEffect(() => {
     if (open) {
       setData({ ...initialData });
       setCores(initialData.cores?.length ? [...initialData.cores] : []);
       setAccepted(false);
       setPhotos({});
       setPhotoPreviews({});
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [open]);
   ```

2. **Verificação rápida** após a correção:
   - Abrir uma rota qualquer (ex.: `/dashboard/projetos/central`) e confirmar que a UI responde sem piscar.
   - Abrir o fluxo China (Nova Submissão / Excel Preview), abrir o diálogo, confirmar que:
     - os campos aparecem preenchidos com `initialData`;
     - o card "Displays / Master" continua calculando corretamente;
     - editar campos não causa flicker;
     - fechar e reabrir o diálogo recarrega os dados atuais.
   - Olhar o console: não deve mais haver bursts de logs de render.

## Escopo

- **Arquivo alterado:** `src/components/china/ChinaDataValidationDialog.tsx` (apenas o array de dependências do `useEffect`, ~1 linha).
- **Sem mudanças** em lógica de negócio, no card novo "Displays / Master", ou nas telas que consomem o diálogo.

## Por que não outras abordagens

- Memoizar `initialData` em cada chamador (`ChinaExcelPreview`, `ChinaNovaSubmissao`) também resolveria, mas exige mudanças em múltiplos arquivos e deixa o diálogo frágil para futuros consumidores. A correção dentro do próprio diálogo é mais segura e localizada.
