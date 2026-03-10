

# Análise de Eficiência do Módulo China — Perspectiva Operacional

## Resumo Geral

O módulo está **bem estruturado na arquitetura** mas tem **lacunas operacionais importantes** que impactariam o dia a dia real. Analisei cada perspectiva:

---

## Perspectiva CHINA (Operador da Fábrica)

### O que funciona bem
- Upload via IA (Excel/foto) com extração automática — excelente UX
- Interface bilíngue consistente (PT/CN) em todas as telas
- Wizard em 3 etapas (Dados > Documentos > Pesos) é claro e guiado
- Grade de cores editável com EAN/hex

### Problemas identificados

1. **Sem notificação quando Brasil aprova/rejeita**: A China submete e... fica no escuro. Não há sistema de notificação ou indicador visual de "novidades". O operador precisa entrar manualmente para checar status.

2. **Sem chat/comunicação direta na ficha**: Quando o Brasil rejeita um documento, a observação é um campo de texto estático. Não há diálogo — a China não consegue responder ou pedir esclarecimento.

3. **Sem resubmissão guiada**: Se um documento é rejeitado, a China precisa re-uplodar mas não há fluxo claro de "corrigir e reenviar". O status do documento rejeitado fica vermelho mas o caminho de correção é implícito.

4. **Sem dashboard de pendências**: A China vê "Minhas Submissões" mas sem filtro por "precisa da minha ação" vs "aguardando Brasil". Num dia a dia com 20+ produtos, isso é ineficiente.

5. **Apontamentos de produção**: A China registra produção mas o formulário de apontamento não aparece acessível na ficha (apenas via OC). O fluxo para registrar lotes produzidos é fragmentado.

---

## Perspectiva BRASIL (Equipe de Desenvolvimento)

### O que funciona bem
- Separação de permissões (isBrasilUser) impede a China de aprovar/rejeitar
- Criação automática de projeto com template e tarefas bilíngues por departamento
- Rastreabilidade bidirecional (Projeto <-> Submissão China)
- Emissão de OC com progresso de produção
- Arte Final + EAN com fluxo dedicado

### Problemas identificados

1. **ChinaRecebimentos.tsx NÃO aplica filtro de permissão**: A página de recebimentos (lista + detalhe lateral) ainda mostra botões de Aprovar/Rejeitar/Emitir OC/Arte Final para TODOS os usuários. O `isBrasilUser` só foi aplicado em `ChinaFichaProduto.tsx`, mas `ChinaRecebimentos.tsx` mantém todos os botões visíveis sem verificação. **Este é um bug de segurança/UX.**

2. **Sem atribuição automática de responsáveis**: Quando o projeto é criado com tarefas para Regulatório, Embalagem, Criação — as tarefas ficam sem responsável. Na prática, o coordenador teria que entrar em cada tarefa e atribuir manualmente. Com 15 tarefas, isso é tedioso.

3. **Sem timeline/prazo automático**: As tarefas criadas não têm datas. Um projeto real precisa de prazos mínimos para cada etapa (ex: Regulatório = 30 dias, Criação = 15 dias).

4. **Sem vinculação de produto às tarefas do projeto**: O hook `useChinaProjeto.ts` cria tarefas mas NÃO vincula via `projeto_tarefa_produtos`. O plano mencionava isso mas não foi implementado. A rastreabilidade tarefa-produto está quebrada.

5. **Sem histórico registrado**: O plano previa registrar no histórico (`fabrica_produtos_historico`) quando um projeto é criado. Isso não foi implementado — a auditoria do produto fica incompleta.

6. **Sem visão consolidada de todos os produtos China em desenvolvimento**: O Brasil não tem uma tela tipo "Painel de Produtos China" que mostre todos os produtos com seus respectivos status de submissão + progresso do projeto lado a lado.

---

## Análise de Duplicação

`ChinaRecebimentos.tsx` e `ChinaFichaProduto.tsx` têm **lógica duplicada massiva** — ambos implementam:
- Aprovação de submissão e documentos
- Upload/view de documentos
- Arte Final + EAN
- Emitir OC dialog

A `ChinaRecebimentos` ficou como uma tela legada. Hoje o clique na lista já navega para `ChinaFichaProduto`, tornando o painel de detalhe lateral da ChinaRecebimentos redundante.

---

## Plano de Correção (Priorizado)

### P0 — Bugs/Segurança
1. **Aplicar `isBrasilUser` em `ChinaRecebimentos.tsx`** — ou eliminar a duplicação redirecionando sempre para a ficha
2. **Vincular produto às tarefas** no `useChinaProjeto.ts` via `projeto_tarefa_produtos`

### P1 — Eficiência Operacional
3. **Painel de pendências para China**: Filtro "Precisa da minha ação" (documentos rejeitados para resubmeter)
4. **Notificações na ficha**: Badge visual de "Novo" quando status muda (usando campo `updated_at` vs último acesso)
5. **Atribuição de responsáveis por departamento**: Ao criar projeto, buscar membros do departamento correspondente e atribuir automaticamente

### P2 — Rastreabilidade
6. **Registrar criação de projeto no histórico do produto**
7. **Prazos automáticos nas tarefas** baseados em regras por seção

### P3 — Limpeza
8. **Simplificar `ChinaRecebimentos.tsx`**: Remover painel de detalhe lateral (já obsoleto), manter apenas lista com navegação para ficha

---

## Arquivos Impactados

| Arquivo | Ação | Prioridade |
|---------|------|------------|
| `src/pages/ChinaRecebimentos.tsx` | Aplicar `isBrasilUser` ou simplificar removendo detalhe lateral | P0 |
| `src/hooks/useChinaProjeto.ts` | Adicionar vinculação `projeto_tarefa_produtos` + histórico | P0/P2 |
| `src/pages/ChinaFabrica.tsx` | Adicionar badge de pendências para China | P1 |
| `src/pages/ChinaFichaProduto.tsx` | Indicador visual de mudanças recentes | P1 |

