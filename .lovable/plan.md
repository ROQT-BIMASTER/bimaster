

# Relatório Técnico de Desenvolvimento de Produtos

Criar uma nova página `/relatorio-desenvolvimento` seguindo exatamente o mesmo formato do Relatório de Segurança (imprimível, ASCII diagrams, tabelas detalhadas, seções com page-break).

## Estrutura do Relatório (14 seções)

### Capa
- Ícone: Package (lucide)
- Título: "Relatório Técnico — Ciclo de Vida do Produto"
- Subtítulo: "Sistema BiMaster / Huggs PLM"
- Badge: "12 Estágios | 6 Módulos | Governança Completa"

### Seção 1 — Resumo Executivo
Tabela com os 6 módulos e seus status de implementação:
- Pipeline 12 estágios, Wizard integrado, Testes/Amostras, Checklist Embalagem, Pipeline ANVISA, Aprovação + RNC

### Seção 2 — Pipeline de 12 Estágios (ASCII)
Diagrama ASCII mostrando o fluxo completo:
```
IDEIA → PROJETO → PRE-CADASTRO → DESENVOLVIMENTO → TESTES → EMBALAGEM → REGULATORIO → CADASTRO FINAL → APROVACAO → PRODUCAO → LANCAMENTO
```
Com descrição de cada estágio, responsáveis e pré-requisitos de transição.

### Seção 3 — Origem da Demanda
Detalhamento da fase "Ideia/Projeto": fontes (viagem China, pesquisa tendência, diretoria), campos do projeto (marca, categoria, origem), Wizard de criação automática.

### Seção 4 — Pré-Cadastro do Produto
Tabela com todos os 50+ campos do `produtos_brasil`, organizados por categoria (Identificação, Comercial, Fiscal, Regulatório, Custos, Embalagem, Formulação).

### Seção 5 — Módulo de Testes e Amostras
Fluxograma ASCII do ciclo de testes:
```
Amostra Solicitada → Recebida → Em Teste → Aprovada/Reprovada → Ajuste
```
Tabela com 5 tipos de teste (cor, fragrância, textura, aplicador, estabilidade) e seus critérios.

### Seção 6 — Desenvolvimento de Embalagem
Lista dos 12 itens do checklist estruturado (faca primária, display, cartucho, tester, etiquetas, medidas, peso, arte, mockup, foto). Fluxo de aprovação por item.

### Seção 7 — Pipeline Regulatório ANVISA
Diagrama ASCII do fluxo de 5 etapas:
```
Análise → Dossiê → Enviado ANVISA → Em Aprovação → Aprovado
```
Campos rastreados: processo, datas, taxa, observações.

### Seção 8 — Cadastro Final
Validações de completude obrigatórias antes da transição. Checklist de 7 itens regulatórios + EAN/NCM.

### Seção 9 — Aprovação Física e RNC
Fluxograma do processo de aprovação (5 critérios: cor, textura, fragrância, rotulagem, peso). Diagrama do fluxo de Não Conformidade (RNC):
```
Não Conforme → Gera RNC → Notifica Fornecedor → Ação Corretiva → Resolução
```

### Seção 10 — Tabelas de Dados (Schema)
Diagrama ASCII das 8 tabelas envolvidas e seus relacionamentos:
```
projetos → produtos_brasil → produto_testes
                           → produtos_brasil_checklist
                           → produtos_brasil_custos
                           → produtos_brasil_skus
                           → produto_aprovacoes_fisicas → produto_rnc
```

### Seção 11 — Controle de Acesso
Papéis por fase: Gestor de Produto, Regulatório, Design, QA, Admin Cofre, Diretoria. Restrições: módulo Projetos exclusivo admin, template Desenvolvimento restrito.

### Seção 12 — Integrações
China → Brasil (onboarding), Cofre de Documentos (versionamento), Briefing IA, Image Timeline (5 etapas).

### Seção 13 — Métricas e Indicadores
KPIs sugeridos: tempo médio por estágio, taxa de aprovação de testes, RNCs abertas, produtos em cada fase.

### Seção 14 — Conclusão
Resumo do sistema como PLM completo.

## Implementação Técnica

### Arquivo novo
- `src/pages/RelatorioDesenvolvimento.tsx` — página completa (mesmo padrão do `RelatorioSeguranca.tsx`)

### Rotas novas no App.tsx
- `/dashboard/relatorio-desenvolvimento` (protegida por admin)
- `/relatorio-desenvolvimento` (acesso público como o de segurança)

### Estilo
- Mesmo CSS de impressão (@media print)
- Mesmo layout: `max-w-5xl mx-auto p-6 space-y-8`
- ASCII art em `<pre>` para diagramas (fidelidade em impressão/PDF)
- Tabelas com `border-collapse` e zebra striping
- Page breaks entre seções principais

