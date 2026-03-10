

## Plan: Draft Editing & Post-Send Lock

### What changes

**1. `ChinaFichaProduto.tsx` — Add "Edit" button for drafts**
- When `submissao.status === "rascunho"`, show a prominent "Editar / Ajustar 编辑/调整" button in the action buttons area that navigates to `/dashboard/fabrica-china/nova/${id}`.
- Add a visual banner at the top indicating this is still a draft and can be edited.

**2. `ChinaNovaSubmissao.tsx` — Read-only mode for non-draft submissions**
- When resuming an existing submission (`editId`), check the loaded status.
- If status is NOT `rascunho`, render all fields as disabled/read-only: inputs, file uploads, grade editor, and hide the "Save Draft" and "Send to Brazil" buttons.
- Show a lock banner: "Esta submissão já foi enviada e não pode ser alterada. 此提交已发送，无法更改。"
- This prevents any modifications after the submission leaves draft status.

**3. `ChinaRecebimentos.tsx` — Allow opening form for any status**
- Currently drafts go to `/nova/:id` and others go to `/produto/:id`. Keep this behavior but also ensure the detail page (`ChinaFichaProduto`) has the edit shortcut for drafts.

### Summary of behavior
- **Rascunho (Draft)**: Full editing via the submission form. "Editar" button on the product detail page routes back to the form.
- **Enviado or later**: All fields locked. User can only view data on the detail page. The submission form, if accessed directly, shows read-only mode with a lock banner.

