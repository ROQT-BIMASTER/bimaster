# Central de Novidades — comunicação de mudanças e instruções

Objetivo: sempre que uma nova versão for publicada, o usuário recebe um resumo claro do que mudou e como usar, logo ao entrar no sistema. O conteúdo pode ser publicado junto com o release e também editado pelo administrador na tela.

## Como o usuário vê

1. Ao entrar no sistema, se houver novidades ainda não vistas, abre um modal "Novidades".
2. O modal mostra um card por novidade: título, descrição em texto formatado, imagem ou vídeo opcional, e um botão "Ir para a tela" quando houver link.
3. Vários itens são navegáveis em sequência (Anterior / Próximo) e o botão final é "Entendi".
4. Fechar marca tudo como visto — não reaparece. Reabrir é possível pelo item "Novidades" no menu do usuário, que também lista o histórico completo.
5. Um selo discreto com a versão atual continua no rodapé/menu, agora clicável para abrir o histórico.

## Como o conteúdo é criado

- Uma tela administrativa "Novidades" (somente admin) permite criar, editar, despublicar e reordenar itens: título, descrição, mídia (imagem ou vídeo), link de destino, versão associada e data de publicação.
- Eu também publico entradas diretamente no lançamento de cada versão; o admin pode complementar ou corrigir depois pela mesma tela.
- Sem segmentação: todos os usuários veem a mesma lista.

## Detalhes técnicos

Banco de dados:
- Tabela `novidades`: `id`, `titulo`, `descricao` (markdown), `midia_url`, `midia_tipo` (`imagem` | `video`), `link_destino`, `versao`, `publicado` (bool), `publicado_em`, `ordem`, `created_by`, timestamps.
- Tabela `novidades_visualizacoes`: `user_id`, `novidade_id`, `visto_em` (PK composta).
- GRANTs explícitos + RLS: leitura de itens publicados para `authenticated`; escrita apenas para admin via `has_role(auth.uid(),'admin')`; visualizações restritas ao próprio `user_id`.
- Bucket privado `novidades-midia` para imagens/vídeos, com path por UID e validação de tipo/tamanho já usada no projeto.

Frontend:
- `src/hooks/useNovidades.ts` — busca itens publicados e os não vistos pelo usuário; mutation para marcar como visto.
- `src/components/novidades/NovidadesDialog.tsx` — modal com carrossel de cards, mídia e CTA.
- `src/components/novidades/NovidadesHistorico.tsx` — lista completa por versão, acessível pelo menu do usuário.
- `src/pages/admin/NovidadesAdmin.tsx` + formulário de edição com upload de mídia.
- Disparo do modal após o login e após a hidratação das permissões, com guarda para não competir com o gate de recarregamento do PWA.
- Tokens semânticos do design system, sem cores literais; tom profissional, sem emojis.

Processo de release:
- No bump de `APP_VERSION`, criar a entrada correspondente em `novidades` além do changelog já exigido em `ApiDocumentation.tsx`.

## Fora de escopo desta entrega

Notificação no sino, e-mail de release, tour guiado passo a passo e segmentação por módulo/perfil. A estrutura de dados fica preparada para adicionar esses canais depois.
