

# Adicionar Colaboradores como Membros e Corrigir Fotos

## Situação Atual

- **17 colaboradores** ativos em tarefas dos projetos (K, Sazonais, Institucional, BiMaster) que **não são membros formais** (`projeto_membros`)
- **8 colaboradores sem foto**: Ahmad, Gabriela Rocha, Giulia Honda, Ingrid Rodrigues Lima, Isabella Moraes, Natasha Figueredo de Lima, Nathalia Freitas Piovani, Saynara dos Santos de Freitas
- **9 colaboradores com foto** já salva (signed URLs do storage)
- As fotos ausentes precisam ser re-importadas do Asana via re-sync

## Plano

### 1. Inserir colaboradores como membros formais dos projetos

Usar a ferramenta de inserção para adicionar os 32 registros (17 usuários x seus respectivos projetos) na tabela `projeto_membros` com papel `membro`.

Mapeamento:
- **BiMaster**: Ahmad + Luana (2 inserções)
- **Institucional**: Daniele, Saynara, Nathalia, Isabella, Gabriela (5)
- **K | Ruby Rose**: 16 colaboradores
- **Sazonais**: Daniele, Saynara, Nathalia, Claudia, Mayara, Isabella, Gabriela, Patrícia (8)

### 2. Atualizar Edge Function para forçar atualização de fotos

Atualmente, a linha 111 do `asana-sync/index.ts` só atualiza o avatar se `!prof.avatar_url`. Alterar para **sempre atualizar** quando o Asana retorna foto e o avatar local está vazio, garantindo que os 8 usuários sem foto recebam a imagem na próxima sincronização.

### 3. Garantir exibição de fotos em todos os ambientes

Verificar e ajustar o componente de avatar para tratar corretamente URLs externas do Asana (que são diretas, não signed URLs). O hook `useResolvedAvatarUrl` já trata URLs externas corretamente (linha 22: se não contém `/storage/v1/object/public/avatars/`, retorna como está).

## Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| Dados (INSERT) | 32 registros em `projeto_membros` |
| `supabase/functions/asana-sync/index.ts` | Forçar update de avatar quando Asana tem foto e perfil não tem |

## Resultado esperado

Todos os 17 colaboradores aparecerão como membros formais dos projetos, com acesso restrito às tarefas onde estão marcados. Na próxima sincronização, as 8 fotos faltantes serão importadas.

