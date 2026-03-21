

# Redesign da Documentação API + Exportação Excel para Postman

## Problema atual

A documentação usa 30+ abas horizontais (TabsList) que ficam apertadas e difíceis de navegar. Não segue um padrão profissional de documentação de API como o do Omie Developer Portal, que agrupa APIs por módulos em uma tabela limpa com nome, descrição e versão. Além disso, não há opção de exportar os endpoints para facilitar criação de collections no Postman.

## Referência visual (Omie Developer Portal)

O Omie organiza em blocos por módulo ("Geral", "Cadastros Auxiliares", "CRM", "Finanças") onde cada bloco tem:
- Header colorido com nome do módulo e descrição
- Tabela com 3 colunas: Nome da API (link), Descrição, Versão (badge `v1`)
- Ao clicar, abre página de detalhe com métodos, parâmetros, exemplos

## Mudanças propostas

### 1. Reestruturar layout: de abas para lista agrupada por módulo

Substituir as 30+ tabs por seções colapsáveis agrupadas em **4 módulos**:

| Módulo | APIs incluídas |
|---|---|
| **Geral** | Clientes, Empresas, Departamentos, Categorias, Projetos, Parcelas |
| **Cadastros Auxiliares** | Tipos Atividade, Tipos Anexo, Tipos Entrega, Tipos Documento, CNAE, Cidades, Países, Bancos, Bandeiras, Origens, Final. Transferência, DRE |
| **Finanças** | Contas a Pagar, Contas a Receber, Boletos, Contas Correntes, Lançamentos CC, Exportação, Orçamentos, Pesquisar Lançamentos, Movimentos Financeiros, Resumo Financeiro |
| **Dados Complementares** | Anexos, Webhook Inbound |

Cada módulo terá:
- Header com fundo colorido (estilo Omie), nome do módulo e descrição
- Lista de APIs em formato tabela: Nome | Descrição | Versão (`v1`) | Nº endpoints
- Ao clicar em uma API, expande mostrando os endpoints (reutiliza `EndpointCard` atual)

### 2. Adicionar busca global

Campo de busca no topo que filtra APIs e endpoints por nome, path ou descrição.

### 3. Botão "Exportar para Excel"

Gera planilha Excel com todas as informações para criar collection Postman:

**Aba 1: Endpoints**
| Módulo | API | Método | Path | URL Completa | Descrição | Body (JSON) | Response (JSON) |

**Aba 2: Parâmetros**
| API | Endpoint | Parâmetro | Tipo | Obrigatório | Descrição |

**Aba 3: Autenticação**
| Informação resumida de como autenticar |

Usa o utilitário `exportToExcel` de `src/lib/excel-utils.ts` já existente (multi-sheet).

### 4. Sidebar de navegação rápida (opcional, dentro do card)

Lista compacta dos módulos e APIs à esquerda para jump-to rápido, similar ao menu lateral do Omie.

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Reescrever — layout por módulos, busca, botão Excel |

## Detalhes técnicos

- Os dados de endpoints (arrays `contasPagarCrud`, `clientesCrud`, etc.) permanecem iguais, apenas reorganizados em uma estrutura `modules[]`
- Exportação Excel usa `exportToExcel` de `src/lib/excel-utils.ts` (multi-sheet com ExcelJS)
- Layout responsivo: em telas menores, sidebar de navegação colapsa
- Sem alterações no backend ou edge functions

