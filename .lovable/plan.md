
# Corrigir Erro de Importacao Dinamica e Preparar para Producao

## Problema Identificado

O erro `TypeError: Failed to fetch dynamically imported module` ocorre quando o Vite tenta carregar um modulo lazy (como `PrecosMatrizComparativa.tsx`) e a requisicao de rede falha. Isso pode acontecer por:

1. **Durante desenvolvimento**: Hot Module Replacement (HMR) reconstroi o modulo e a URL antiga fica invalida temporariamente
2. **Em producao**: Apos um novo deploy, as URLs dos chunks antigos mudam e usuarios com a pagina aberta tentam navegar para rotas cujos chunks ja nao existem

Testei ambas as paginas (`/dashboard/precos/matriz` e `/dashboard/precos`) e elas carregam normalmente agora. O erro e intermitente.

## Solucao

### 1. Adicionar retry automatico nos lazy imports (App.tsx)

Criar uma funcao `lazyWithRetry` que tenta importar o modulo e, em caso de falha, faz ate 3 tentativas com intervalo. Se todas falharem, forca um reload da pagina (para buscar o novo manifest apos deploy).

```text
lazyWithRetry(importFn)
  tentativa 1 -> falhou? espera 1s
  tentativa 2 -> falhou? espera 1s  
  tentativa 3 -> falhou? window.location.reload()
```

### 2. Aplicar `lazyWithRetry` em todas as ~140 rotas lazy

Substituir todos os `lazy(() => import("./pages/..."))` por `lazyWithRetry(() => import("./pages/..."))`.

### 3. Melhorar o fallback do Suspense

O `PageLoader` atual mostra um spinner. Adicionar deteccao de erro de carregamento com mensagem amigavel e botao de "Tentar Novamente".

## Arquivos a Modificar

- **`src/App.tsx`**: Criar funcao `lazyWithRetry` e aplicar em todas as importacoes lazy (~140 linhas)

## Detalhes Tecnicos

A funcao `lazyWithRetry`:

```text
function lazyWithRetry(importFn, retries = 3, interval = 1000) {
  return lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error) {
        if (i === retries - 1) {
          // Ultima tentativa falhou - verificar se e erro de chunk
          // e forcar reload para buscar novo manifest
          if (!sessionStorage.getItem('chunk-reload')) {
            sessionStorage.setItem('chunk-reload', 'true');
            window.location.reload();
          }
          throw error;
        }
        await new Promise(r => setTimeout(r, interval));
      }
    }
    return importFn(); // fallback final
  });
}
```

A flag `sessionStorage('chunk-reload')` evita loops infinitos de reload. E limpa ao carregar com sucesso.

## Resultado Esperado

- Erros de chunk intermitentes serao resolvidos automaticamente com retry
- Apos deploys em producao, usuarios nao verao mais a tela "Algo deu errado" ao navegar
- A experiencia sera transparente: o usuario vera no maximo um breve delay no carregamento
