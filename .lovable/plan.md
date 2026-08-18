# Anexos do módulo China — diagnóstico e hardening completo

## O que foi verificado

Levantamento dos fluxos de anexo do módulo China e das restrições do armazenamento:

- Hook principal de anexo do checklist (`useUploadChinaDocumento`) já tem validação local, retry, timeout e rollback.
- Outros pontos de anexo do módulo **não** seguem o mesmo padrão: comentários de documento, uma das rotas de revisão de documento, pareceres de submissão e a promoção de item de checklist no chat sobem arquivos sem validação prévia e/ou sem retry.
- O armazenamento tem uma lista de tipos permitidos **mais restrita** que a validação do front. Confirmado hoje:
  - `china-documentos` e `china-pasta-digital` não aceitam: GIF, TXT, CSV, ZIP, PowerPoint (PPT/PPTX), vídeos.
  - `china-chat-anexos` não aceita: Word, Excel, XML, HEIC.
  - Resultado: o arquivo passa na validação da tela, é enviado, e o servidor recusa. O erro cai no caminho "desconhecido", o sistema tenta 3 vezes e exibe uma mensagem genérica — exatamente o sintoma relatado.
- Formatos comuns em fornecedores chineses não são aceitos em lugar nenhum hoje: RAR, 7Z, EPS, CDR, DWG, SVG, TIFF.
- A telemetria de upload existe apenas na memória do navegador; não há registro no servidor, então hoje não é possível confirmar qual é o erro exato que a equipe da China está vendo.

## Entregas

### 1. Registro de falhas (para parar de trabalhar no escuro)
- Persistir eventos de rejeição/erro de upload (módulo, tipo, tamanho, código do erro, usuário, contexto) para consulta.
- Tela administrativa simples de consulta das últimas falhas de anexo, filtrando por módulo e período.

### 2. Alinhar tipos aceitos (fim do erro genérico)
- Unificar a lista de tipos permitidos entre a validação da tela e o armazenamento, em todos os buckets do módulo China (documentos, pasta digital, chat, pareceres, revisões).
- Incluir os formatos usados pelos fornecedores: RAR, 7Z, EPS, CDR, DWG, SVG, TIFF, além de GIF, TXT, CSV, ZIP, PowerPoint e vídeos onde faz sentido.
- Quando o tipo não for aceito, a mensagem passa a dizer o formato recebido e a lista de formatos aceitos, antes de qualquer envio.

### 3. Padronizar o envio em todos os ambientes do módulo
Aplicar o mesmo padrão do checklist (validação local, envio em partes com retomada, tempo limite, tentativas com espera crescente, remoção do arquivo órfão em caso de falha de cadastro, mensagens por tipo de erro, atualização automática das telas) em:
- Comentários de documento
- Revisão de documento (rota de nova versão)
- Pareceres de submissão
- Pasta digital
- Chat da China (incluindo promoção de item de checklist)
- Anexos vinculados a tarefas do Kanban Brasil

### 4. Resiliência de rede para a equipe na China
- Elevar o tempo limite por tentativa e aumentar o número de tentativas para arquivos grandes.
- Barra de progresso real e botão de cancelar/retomar no envio.
- Detecção de conexão instável com mensagem orientando retomar em vez de recomeçar.
- Mensagens de erro do fluxo de anexos em português e chinês, seguindo o padrão já usado no módulo.

### 5. Testes
- Teste de cada código de erro mapeado (tipo recusado, sessão expirada, arquivo grande, rede, permissão, conflito).
- Teste de paridade automática entre a lista de tipos da tela e a do armazenamento, para impedir que voltem a divergir.

## Detalhes técnicos

- Ampliar `ALLOWED_EXTENSIONS` / `ALLOWED_MIME_TYPES` e as assinaturas de magic bytes em `src/lib/utils/file-security.ts` (RAR `52 61 72 21`, 7Z `37 7A BC AF`, TIFF `49 49 2A 00` / `4D 4D 00 2A`, EPS, SVG por conteúdo texto).
- Migração ajustando `allowed_mime_types` de `china-documentos`, `china-pasta-digital`, `china-chat-anexos`, `china-pareceres`, `china-submissao-foto-oficial` para o mesmo conjunto, com `file_size_limit` uniforme de 1 GB.
- Extrair o núcleo de `useUploadChinaDocumento` para um utilitário compartilhado (`src/lib/china/uploadCore.ts`) e reusar em `useChinaDocComentarios`, `useChinaRevisoes` (linha ~573), `useSubmissaoPareceres`, `useChinaPastaDigital` e `PromoverChecklistDialog`.
- Mapear explicitamente o erro de MIME recusado do armazenamento para um código próprio (`STORAGE_MIME_REJECTED`), sem retry, com mensagem específica.
- Nova tabela de auditoria de uploads com RLS (leitura restrita a administradores, escrita pelo próprio usuário) e GRANTs, alimentada por `uploadTelemetry`.
- Progresso via `onProgress` do `resumableUpload`, já suportado e hoje não usado nas telas da China.
