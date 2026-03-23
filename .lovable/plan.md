

# Chave de Acesso NF-e — Digitação Manual, Upload XML e Auto-Preenchimento

## Contexto

Atualmente a chave de acesso NF-e só pode ser digitada manualmente ou sugerida pela IA após auditoria. O usuário quer:
1. **Digitação manual** (já existe)
2. **Upload de XML** que preenche automaticamente a chave e outros dados
3. Essas opções devem estar disponíveis **desde a origem do documento** (CadastroTituloAP) e também na revisão (DocumentAuditCard)

## Plano

### 1. Criar componente reutilizável `ChaveAcessoInput`

Novo componente `src/components/financeiro/ChaveAcessoInput.tsx` que encapsula:
- Input manual com máscara (4 em 4 dígitos), contador de dígitos, validação visual
- Botão "Upload XML" que abre file picker para `.xml`
- Ao selecionar XML, usa o parser `parseNFeXml` existente para extrair `chave_acesso`
- Exibe preview dos dados extraídos (número NF, fornecedor, valor) para confirmação do operador
- Botão "Aplicar" para confirmar o preenchimento automático
- Sugestão IA (quando disponível) com botão aplicar

### 2. Usar o componente na página CadastroTituloAP

Substituir o campo simples de chave NF-e (linhas 519-532) pelo novo `ChaveAcessoInput`. Ao fazer upload do XML, além da chave, preencher automaticamente campos como `numeroDocumento` e `valorDocumento` (com confirmação do operador).

### 3. Usar o componente no DocumentAuditCard

Substituir o bloco de input manual + sugestão IA (linhas 107-148) pelo `ChaveAcessoInput`, passando a sugestão da IA como prop.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/financeiro/ChaveAcessoInput.tsx` | **Novo** — componente reutilizável |
| `src/pages/financeiro/CadastroTituloAP.tsx` | Substituir campo simples pelo novo componente + auto-fill de campos via XML |
| `src/components/financeiro/payments/DocumentAuditCard.tsx` | Substituir bloco manual pelo novo componente |

