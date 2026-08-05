# Foto (avatar) do projeto

Hoje cada projeto tem apenas uma cor (`cor`), usada no quadradinho com a inicial do nome. A ideia é permitir subir uma imagem, igual à foto de usuário, mantendo a cor como fundo padrão quando não houver foto.

## Comportamento

- No diálogo de edição do projeto (e na criação), acima do seletor de cores, aparece um avatar quadrado com a inicial + botão "Enviar foto" / "Remover foto".
- Formatos aceitos: JPG, PNG, WEBP; limite de 5 MB; validação de tipo real do arquivo (magic bytes) antes do envio.
- A foto aparece em todos os lugares onde hoje aparece o quadrado colorido com a inicial:
  - lista/tabela de Projetos e cartões em grade;
  - cabeçalho do projeto;
  - seletor de projetos e diálogos de pastas.
- Sem foto, nada muda: continua o quadrado com a cor e a inicial.
- Quem pode trocar a foto: mesmas regras de quem já pode editar o projeto (criador, gerente do projeto, administradores).

## Detalhes técnicos

1. **Banco**: adicionar coluna `imagem_url text` em `public.projetos` (guarda o caminho no storage, não URL assinada).
2. **Storage**: novo bucket privado `projeto-capas`, caminho `<projeto_id>/capa.<ext>`. Políticas de storage:
   - leitura para membros do projeto (semi-join em `projeto_membros` / regra de acesso já existente);
   - escrita/remoção apenas para quem pode editar o projeto.
3. **Front**:
   - novo componente `ProjetoAvatar` (`src/components/projetos/ProjetoAvatar.tsx`) que resolve a URL assinada (reaproveitando `useResolvedAvatarUrl`) e faz fallback para cor + inicial;
   - upload em `EditarProjetoDialog.tsx` e `NovoProjetoDialog.tsx` (no caso de criação, upload após a criação do registro);
   - substituir os blocos `style={{ backgroundColor: projeto.cor }}` + inicial por `<ProjetoAvatar />` em `src/pages/Projetos.tsx`, `ProjetoHeader.tsx` e barra/diálogos de pastas.
4. **Testes**: teste de unidade do fallback do `ProjetoAvatar` (com e sem foto) e da validação de arquivo.
5. Bump de `APP_VERSION` + entrada no changelog em `src/pages/admin/ApiDocumentation.tsx`.
