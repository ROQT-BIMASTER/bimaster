Diagnóstico: o preview não está mais em tela totalmente branca; ele abre uma tela de erro 404 em `/index`. A raiz `/` carrega e redireciona para login corretamente. Também há 401 no `manifest.webmanifest`, que não derruba a tela, mas polui o console e pode interferir no comportamento PWA/cache.

Plano de correção:

1. Corrigir a rota `/index`
   - Adicionar rota explícita para `/index` redirecionando para `/auth/login` ou reaproveitando o componente `Index`.
   - Manter o catch-all 404 apenas para rotas realmente inexistentes.

2. Blindar a tela inicial contra vazio visual
   - Ajustar `Index.tsx` para renderizar um loader mínimo enquanto executa o redirect, em vez de `return null`.
   - Isso evita a percepção de tela branca caso o redirect demore no preview/mobile.

3. Reduzir interferência do PWA no preview
   - Remover o `<link rel="manifest" href="/manifest.webmanifest" />` manual do `index.html` ou condicionar a estratégia para não gerar erro 401 no ambiente de preview.
   - Como o app já usa `vite-plugin-pwa`, o manifesto deve ser gerenciado pelo plugin em build, evitando requisição protegida/indevida no preview.

4. Validar no preview
   - Testar `/`, `/index` e `/auth/login` no viewport mobile atual.
   - Confirmar que `/index` não cai mais no 404 e que a tela inicial não fica branca.
   - Conferir console para garantir ausência de erro fatal de JavaScript.