
## Ajuste seguro para visualização de evidências

### Diagnóstico
O bloqueio atual tem dois pontos principais:

1. A abertura do arquivo depende de `window.open(...)` depois de uma operação assíncrona (`await downloadStorageBlob(...)`), então o navegador pode tratar como popup não confiável e bloquear.
2. Parte das evidências está sendo salva como URL assinada longa, em vez de salvar apenas o caminho do arquivo. Isso é menos seguro, pode expirar, pode ser interceptado por extensões e dificulta padronizar a abertura.

### Solução proposta
Trocar a estratégia de “abrir em nova aba” por uma visualização interna e segura dentro do sistema:

1. **Visualizar dentro de um Dialog**
   - Ao clicar em “Visualizar”, abrir imediatamente um modal no próprio app
   - O modal carrega o arquivo via SDK autenticado (`storage.download()`), sem depender de URL pública/signed URL no navegador
   - PDF e imagem serão exibidos no próprio modal
   - Arquivos não suportados terão mensagem de preview indisponível + botão de download

2. **Download seguro**
   - O botão “Download” continuará baixando via Blob + link temporário local
   - Sem `window.open` para download
   - Nome do arquivo preservado

3. **Padronização segura dos uploads**
   - Novos uploads de evidências devem salvar **somente o path do storage**
   - Parar de persistir signed URL de 1 ano nas evidências da fábrica
   - Manter compatibilidade com registros antigos que já salvaram URL completa

4. **Compatibilidade com dados legados**
   - O helper de download/preview continuará aceitando:
     - path puro
     - signed URL antiga
     - URL autenticada do storage
   - Se vier URL antiga, o sistema extrai bucket/path e baixa pelo SDK

### Implementação
#### 1. Criar um visualizador reutilizável de arquivos
Criar um componente de preview para a fábrica, por exemplo:
- `StoragePreviewDialog` ou `FabricaDocPreviewDialog`

Esse componente deve:
- abrir rápido no clique
- mostrar loading
- baixar o arquivo autenticado
- detectar tipo por extensão/MIME
- renderizar:
  - `img` para imagens
  - `iframe`/`object` com blob local para PDF
  - fallback para outros tipos
- revogar `URL.createObjectURL(...)` ao fechar

#### 2. Fortalecer o utilitário de storage
Ajustar `src/lib/utils/storage-download.ts` para retornar mais contexto:
- `blob`
- `blobUrl`
- `contentType`
- `filename` opcional
- erro padronizado

Também centralizar a resolução de bucket/path para suportar path puro e URLs antigas.

#### 3. Substituir a abertura atual nas telas afetadas
Aplicar o novo fluxo em:
- `src/components/fabrica/FichaAnalisePanel.tsx`
- `src/components/fabrica/FichaCustoProdutoEditor.tsx`

Troca principal:
- remover `window.open(blobUrl, "_blank")`
- usar estado local para abrir o dialog de preview
- manter botão de download separado

#### 4. Corrigir a gravação de novas evidências
No upload de evidências da fábrica:
- salvar `path` no campo `url_arquivo`
- não gerar/salvar signed URL longa
- leitura antiga continua funcionando pelo helper novo

### Arquivos envolvidos
- `src/lib/utils/storage-download.ts`
- novo componente de preview reutilizável
- `src/components/fabrica/FichaAnalisePanel.tsx`
- `src/components/fabrica/FichaCustoProdutoEditor.tsx`

### Detalhes técnicos
- O bucket deve continuar privado
- A leitura deve ocorrer com sessão autenticada do usuário
- Evitar exposição de links diretos duradouros
- Liberar `blobUrl` com `URL.revokeObjectURL` ao fechar para evitar vazamento de memória
- Se houver outros pontos da fábrica usando signed URL direto para preview, aplicar o mesmo padrão depois para manter consistência

### Validação
Vou considerar concluído quando:
1. usuário clicar em “Visualizar” e o documento abrir dentro do sistema
2. PDF carregar sem nova aba
3. imagem carregar normalmente
4. arquivo não suportado permitir download
5. download funcionar mesmo com bloqueadores ativos
6. evidências novas passarem a abrir pelo path salvo, sem depender de URL assinada longa
