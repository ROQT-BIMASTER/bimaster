# Teste funcional — Módulo China (Submissões e Checklist)

Objetivo: percorrer as telas de Submissões e Checklist do módulo China na pré-visualização, com sessão real, e entregar um relatório de falhas. Nenhuma correção de código será aplicada nesta rodada.

## Pré-requisito

Login ativo na janela de pré-visualização. Sem sessão, as telas do módulo China ficam bloqueadas pelas regras de acesso por tela (`china_submissoes`, `china_fichas`, `china_dashboard`) e o teste não sai do lugar.

## Telas cobertas

| Tela | Caminho |
|---|---|
| Painel China | `/dashboard/fabrica-china` |
| Nova submissão | `/dashboard/fabrica-china/nova` |
| Detalhe da submissão | `/dashboard/fabrica-china/submissao/:id` |
| Ficha do produto | `/dashboard/fabrica-china/produto/:id` |
| Checklist do produto | `/dashboard/fabrica-china/produto/:id/checklist` |
| Status do checklist | `/dashboard/fabrica-china/produto/:id/checklist-status` |
| Caixa de entrada (recorte da submissão) | `/dashboard/fabrica-china/caixa-entrada?submissao=:id` |

## Roteiro de verificação

1. Navegação e carregamento
   - Cada rota abre sem tela em branco, sem erro de execução e sem redirecionamento indevido.
   - Links internos entre ficha, checklist e submissão levam ao destino certo.
2. Listagem e filtros de submissões
   - Lista carrega, busca e filtros retornam resultados coerentes, estado vazio tem mensagem adequada.
3. Fluxo de nova submissão
   - Formulário abre, validações de campo obrigatório disparam, rascunho é recuperado ao reabrir pela rota com id.
   - Sem criação de registros definitivos: apenas validação de comportamento, com descarte do que for criado para teste.
4. Checklist Brasil–China
   - Itens carregam por categoria, itens customizados e ocultos respeitam a configuração.
   - Status aparece em PT e 中文, cores conforme a paleta central de status.
   - Filtros por situação e ordenação funcionam e persistem.
5. Pareceres e comentários
   - Painel administrativo abre nas abas Pareceres e Comentários.
   - Ações permitidas variam corretamente conforme lado (Brasil/China) e papel de emissor/receptor.
   - Histórico de rodadas lista as revisões.
6. Documentos
   - Pré-visualização abre, botão de nova tentativa aparece em falha, download ocorre como blob.
   - Contadores de documentos aprovados versus total batem com o que a lista mostra.
7. Sinais técnicos durante todo o percurso
   - Erros de console, requisições com falha, chamadas de dados negadas e tempos de resposta anormais.

## Detalhes técnicos

- Execução via Playwright headless contra `http://localhost:8080`, viewport 1280x1800, com a sessão do preview restaurada antes de qualquer rota protegida.
- Captura de tela por etapa, além de coleta de mensagens de console e de requisições com status de erro.
- Consultas de leitura ao banco apenas para conferir se o que a tela mostra corresponde aos registros de submissão, checklist e documentos.
- Execução da suíte automatizada existente relacionada ao módulo (`e2e/china-docs`, `e2e/china-pipeline`) apenas se houver ambiente e credenciais configurados; caso contrário, fica registrado como não executado.

## Entrega

Relatório único no chat com: lista de falhas por severidade (bloqueia uso / atrapalha / cosmético), tela e passo de reprodução, evidência (captura ou mensagem de erro) e causa provável. Correções só depois da sua aprovação.
