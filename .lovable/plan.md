

## Análise Aprofundada — Falhas e Melhorias do Módulo de Desenvolvimento de Produtos

### FALHAS CRÍTICAS ENCONTRADAS

#### 1. `ProjetoAprovacaoCadastro` — Aprovação sem validação de papel (CRÍTICO)
**Arquivo:** `src/pages/ProjetoAprovacaoCadastro.tsx`, linhas 126-150

O `handleAprovar` marca `visivel_fabrica=true` em **todos** os documentos da tarefa **sem verificar** se o usuário tem papel `admin_cofre` ou qualquer outro papel. Qualquer usuário com acesso à rota `/dashboard/projetos/aprovacoes` pode aprovar e liberar documentos para a China.

**Correção:** Validar via RPC `can_publish_to_cofre` antes de aprovar. Exibir erro se não autorizado.

---

#### 2. `ValidacaoFinalDialog.AprovacaoPanel` — Mesma falha (CRÍTICO)
**Arquivo:** `src/components/projetos/ValidacaoFinalDialog.tsx`, linhas 205-242

O `handleAprovar` no `AprovacaoPanel` marca `visivel_fabrica=true` sem checar papel. O comentário na linha 209 diz "CRITICAL: Validate admin_cofre role" mas **a validação nunca é implementada**.

**Correção:** Chamar `can_publish_to_cofre` antes de atualizar `visivel_fabrica`. Esconder botão "Aprovar" para quem não tem papel.

---

#### 3. Auditoria de upload com `produtoId: undefined` (MÉDIO)
**Arquivo:** `src/hooks/useProjetoTarefaDetalhe.ts`, linha 152

```typescript
await logDocAudit({ produtoId: (undefined as any), ... });
```
O `produtoId` é passado como `undefined` no upload de anexos. Todos os registros de auditoria de upload ficam sem vínculo a produto, tornando a rastreabilidade inútil.

**Correção:** Passar `(tarefa as any)?.produto_id` corretamente. Isso requer refatorar `uploadAnexo` para aceitar `produtoId` como parâmetro.

---

#### 4. Exclusão de anexos sem validação de papel (MÉDIO)
**Arquivo:** `src/components/projetos/TarefaFocusMode.tsx`, linha 558

Qualquer membro pode deletar qualquer anexo (botão `Trash2`), incluindo documentos que já foram enviados ao cofre. Não há validação de papel nem confirmação.

**Correção:** Restringir exclusão a `coordenador`, `gestor_produto` e ao próprio uploader. Adicionar confirmação. Bloquear exclusão de anexos já no cofre.

---

#### 5. Documentos no cofre sem controle de remoção (MÉDIO)
Não existe funcionalidade para **remover** um documento do cofre (`fabrica_revisao_documentos`). Se um documento foi enviado ao cofre por engano, não há como reverter — ele fica permanentemente lá.

**Correção:** Adicionar botão "Revogar do Cofre" visível apenas para `admin_cofre`, que marca `visivel_fabrica=false` e registra auditoria.

---

#### 6. `DocVersionHistory` — Versão nunca é incrementada (MÉDIO)
**Arquivo:** `src/hooks/useProjetoTarefaDetalhe.ts`, linhas 228-235

O `sendToCofre` sempre cria versão `1`. Se o mesmo documento for reenviado ao cofre, haverá múltiplas versões "1" sem incremento. Não há lógica para detectar reenvio ou incrementar a versão.

**Correção:** Antes de inserir, contar versões existentes para o mesmo `documento_id` (ou nome de arquivo) e incrementar.

---

#### 7. `CofreOficialTab` não mostra versão oficial (BAIXO)
**Arquivo:** `src/components/projetos/CofreOficialTab.tsx`

O componente filtra por `visivel_fabrica=true` mas **não verifica** se o documento tem uma versão marcada como `versao_oficial`. Documentos sem versão oficial aprovada aparecem no cofre igualmente.

**Correção:** Cruzar com `produto_documento_versoes` para exibir badge de "Versão Oficial" e filtrar opcionalmente apenas documentos com versão oficial.

---

#### 8. `ProductDevStatusBar` — Status "ajuste_solicitado" bloqueia fluxo (BAIXO)
**Arquivo:** `src/components/projetos/ProductDevStatusBar.tsx`, linha 43-47

A lógica `targetIndex > currentIndex` impede retroagir para "ajuste_solicitado" (posição 2) se o status atual é "arte_em_desenvolvimento" (posição 4). Mas o papel `controle_arte` e `regulatorio` têm "ajuste_solicitado" como transição permitida.

**Correção:** Permitir transição de volta para "ajuste_solicitado" independente da posição, pois é um status de retorno legítimo.

---

#### 9. Sem timeout/debounce nos RPCs de validação (BAIXO)
O `sendToCofre` chama `can_publish_to_cofre` via RPC sem tratamento de timeout. Se o RPC falhar silenciosamente (retornar `null` ao invés de `false`), o código não bloqueia pois `!canPublish` onde `canPublish = null` é `true` — bloqueando corretamente, mas o erro mostrado ao usuário é genérico.

---

### FUNCIONALIDADES AUSENTES PARA PRODUÇÃO

#### 1. Dashboard de Govern