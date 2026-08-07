# Calendário: liberar para todos e corrigir "Acesso Restrito"

## O que foi verificado

- O item de menu "Calendário" existe e aponta para `/dashboard/calendario`, com `screen_code = calendario_geral` e sem exigência de admin.
- A rota `/dashboard/calendario` existe no código e a tela `calendario_geral` já está na lista de telas liberadas por padrão para todo usuário autenticado.
- A tela `calendario_geral` **não está cadastrada** no registro de telas do sistema (só existe `trade_calendar`). Sem esse cadastro, a tela não aparece na administração de permissões nem pode ser concedida/auditada individualmente.
- A mensagem exibida na imagem ("Tela não encontrada ou sem permissão") é a de rota **não encontrada**, e não a de permissão negada. Isso indica que o navegador do usuário carregou uma versão do aplicativo anterior à que introduziu a rota (cache do app), e não um bloqueio de permissão. Esse diagnóstico ainda precisa ser confirmado.

## Etapas

1. **Confirmar a causa**: abrir `/dashboard/calendario` com sessão autenticada na versão atual e comparar com a versão publicada; registrar qual das duas telas de bloqueio aparece (rota inexistente x permissão negada). Se aparecer permissão negada, o foco muda para o item 3.
2. **Cadastrar a tela no registro do sistema**: incluir `calendario_geral` (nome "Calendário", rota `/dashboard/calendario`, módulo Projetos, ativa) para que apareça na administração de acessos, possa ser auditada e concedida individualmente — mantendo a liberação padrão a todos.
3. **Rede de segurança de acesso**: garantir que a rota continue coberta pela liberação padrão e que o item de menu use exatamente o mesmo código de tela, sem exigir módulo adicional.
4. **Rota alternativa**: adicionar um redirecionamento de `/dashboard/projetos/calendario` para `/dashboard/calendario`, evitando bloqueio para quem tiver link antigo salvo.
5. **Forçar atualização dos clientes**: subir a versão do aplicativo e registrar a entrada no changelog, para que os usuários com pacote antigo em cache recebam a nova versão automaticamente.
6. **Validação**: reabrir o calendário como usuário comum (sem privilégios) e confirmar carregamento, filtros e criação de evento; confirmar que a tela aparece na administração de acessos.

## Detalhes técnicos

- Migração: `INSERT` em `telas_sistema` (`codigo='calendario_geral'`, `rota='/dashboard/calendario'`, módulo projetos) com `ON CONFLICT DO NOTHING`; nenhuma alteração de RLS necessária — `calendario_eventos` já tem políticas de autor/participante.
- `src/App.tsx`: manter `ScreenProtectedRoute screenCode="calendario_geral"` e adicionar rota de redirecionamento legada.
- `src/contexts/PermissionsContext.tsx`: `calendario_geral` permanece em `DEFAULT_SCREENS`.
- `src/lib/version.ts`: bump `APP_VERSION` 4.0.7 → 4.0.8 + entrada de changelog em `ApiDocumentation.tsx` (exigência do CI).

## Fora de escopo

- Alterar regras de visibilidade de eventos (privado/compartilhado) ou permissões de tarefas dos projetos.
