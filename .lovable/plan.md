
## Problema

Na tela **Importar Dados do Produto** (China — `ChinaNovaSubmissao.tsx`), o fluxo de IA (planilha Excel, foto/print e manual) falha para usuários que **não são admin/supervisor**. Admins funcionam normalmente.

## Causa raiz

A IA em si (`parse-china-excel`) responde corretamente — o erro ocorre **depois**, ao persistir o resultado:

1. **Storage `china-documentos`** — a policy `china_storage_insert_owned` exige que o **primeiro segmento do path seja `auth.uid()`**:
   ```
   with_check: bucket_id = 'china-documentos'
            AND (storage.foldername(name))[1] = auth.uid()::text
   ```
   Mas o frontend envia em `${submissaoId}/${tipo}/${file.name}` (primeiro segmento = ID da submissão). Resultado: upload bloqueado para todo usuário comum (admin passa por outra policy `ALL` global).

2. **Tabela `china_produto_documentos`** — a policy de INSERT só permite quando o usuário é dono da submissão **ou** tem `check_user_access('fabrica')`. Usuários sem o módulo `fabrica` não conseguem registrar documentos mesmo sendo "membros do projeto".

3. Erros silenciosos: o catch no `handleValidationConfirm` mostra a mensagem genérica "Erro ao salvar dados validados", o que reforça a percepção de "IA não está funcionando".

## Solução

### 1. Corrigir o path de upload no Storage (frontend)

Padronizar todos os uploads para `china-documentos` no formato exigido pela RLS:

```
{auth.uid()}/{submissaoId}/{tipo}/{filename}
```

Locais a ajustar em `src/pages/ChinaNovaSubmissao.tsx`:
- `handleValidationConfirm` (uploads de `pendingSourceFile` e `photoFiles`)
- demais chamadas a `uploadAndGetSignedUrl("china-documentos", ...)` listadas nas linhas ~291–323 e ~456.

Persistir o `arquivo_path` completo (com `uid` na frente) na tabela `china_produto_documentos` para manter consistência com download/delete.

### 2. Atualizar policies de Storage (`china-documentos`)

Manter exigência de ownership por path, agora com a regra correta:

- **INSERT**: `(storage.foldername(name))[1] = auth.uid()::text`  → continua válido com o novo path.
- **SELECT/DELETE**: já permitem dono ou admin/supervisor; adicionar fallback para usuários com acesso ao módulo `fabrica` que precisem revisar documentos compartilhados (via `check_user_access(auth.uid(),'fabrica')`).

### 3. Ajustar policies da tabela `china_produto_documentos`

Tornar simétrico com a submissão: permitir INSERT/SELECT/UPDATE/DELETE para:
- dono da submissão (`s.created_by = auth.uid()`), **ou**
- admin/supervisor, **ou**
- membro do projeto vinculado à submissão (quando aplicável).

Remover dependência exclusiva de `check_user_access('fabrica')`, que é hoje o ponto de bloqueio para usuários sem esse módulo.

### 4. Melhorar feedback de erro no frontend

Em `handleExcelUpload`, `handleImageUpload`, `handleManualEntry` e `handleValidationConfirm`:
- Logar `error.code`, `error.details`, `error.hint` quando disponíveis (Postgres/Storage).
- Exibir mensagem específica para erros de RLS (`new row violates row-level security policy`) explicando que faltam permissões — em vez de "Erro ao salvar".

### 5. Verificação

- Logar pelo menos uma submissão completa com usuário comum (não-admin) usando: planilha Excel, depois foto, depois manual.
- Confirmar nos logs da função `parse-china-excel` que a IA é chamada e retorna `extract_product_data`.
- Confirmar nos logs do Postgres que não há `policy violation` em `china_produto_submissoes`, `china_produto_documentos` nem `storage.objects`.

## Escopo

Somente os fluxos de IA + persistência da submissão China. Não altera:
- Lógica de extração da IA.
- Estrutura das tabelas.
- Outras telas de IA (Fabrica `extrair-produto-ia`, etc.).
