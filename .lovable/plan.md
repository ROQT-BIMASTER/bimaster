

# Seguranca de Upload — Validacao e Protecao contra Arquivos Maliciosos

## Problema

Atualmente, o upload de arquivos no `ProcessDecisionDialog` (e em outros pontos do sistema) aceita qualquer arquivo sem validacao. Um usuario poderia enviar arquivos executaveis (.exe, .bat, .sh), scripts (.js, .html com scripts embutidos), ou arquivos com extensao falsificada contendo malware.

## Estrategia de Protecao (3 camadas)

### Camada 1 — Validacao no Frontend (todos os uploads)

Criar um utilitario centralizado `src/lib/utils/file-security.ts` que sera usado em TODOS os pontos de upload do sistema:

- **Whitelist de extensoes permitidas**: pdf, png, jpg, jpeg, webp, gif, doc, docx, xls, xlsx, csv, xml, zip, txt
- **Whitelist de MIME types**: validar `file.type` contra tipos esperados
- **Limite de tamanho**: maximo 20MB por arquivo
- **Deteccao de extensao dupla**: rejeitar arquivos como `documento.pdf.exe`
- **Validacao de magic bytes**: ler os primeiros bytes do arquivo para confirmar que o conteudo corresponde a extensao declarada (ex: PDF comeca com `%PDF`, PNG com `\x89PNG`)

### Camada 2 — Aplicar no ProcessDecisionDialog

Integrar `validateFileForUpload()` no `handleFileUpload` antes de fazer o upload ao Storage. Exibir toast de erro especifico quando um arquivo for rejeitado.

### Camada 3 — Aplicar no storage-helper centralizado

Adicionar validacao em `uploadFile()` e `uploadAndGetSignedUrl()` no `storage-helper.ts`, para que QUALQUER upload futuro passe pela validacao automaticamente.

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/lib/utils/file-security.ts` | NOVO — utilitario de validacao de arquivos |
| `src/components/processo/ProcessDecisionDialog.tsx` | Integrar validacao antes do upload |
| `src/lib/utils/storage-helper.ts` | Adicionar validacao nas funcoes de upload |

## Detalhes Tecnicos

**Magic bytes validados:**
- PDF: `25 50 44 46` (%PDF)
- PNG: `89 50 4E 47`
- JPEG: `FF D8 FF`
- ZIP/DOCX/XLSX: `50 4B 03 04`
- XML: `3C 3F 78 6D` (<?xm)

**Extensoes bloqueadas explicitamente:** exe, bat, cmd, sh, ps1, vbs, js, html, htm, msi, dll, scr, com, pif, reg, hta, wsf

