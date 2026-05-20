# Agente de Intake — Visão Geral

## O que é

O Agente de Intake é o ponto de entrada de todas as demandas criativas internas da Ruby Rose no sistema Huggs. Ele conversa com solicitantes das equipes de Trade Marketing, Produto, Marketing e Comercial, entende o que precisa ser feito, coleta todas as informações obrigatórias e gera briefings individuais prontos para o ciclo de ativação do time de criação.

O sistema já sabe quem é o usuário (nome, setor, marca principal) — não há fase de identificação. O agente começa direto: **"O que você precisa?"**

---

## Propósito

| Problema atual | O que o agente resolve |
|----------------|------------------------|
| 62% das tarefas sem prazo | Prazo é campo obrigatório na conversa |
| 96,5% das tarefas sem dimensões | Agente coleta ou preenche com padrão |
| Demandas cheias de itens misturados | Agente decompõe em 1 item = 1 task = 1 briefing |
| Solicitações vagas sem contexto | Árvore de perguntas por tipo garante completude |
| Sem campo de canal ou formato de entrega | Coletados na conversa e registrados no briefing |

---

## Fluxo Resumido

```
Descrição livre
      ↓
Classificação automática (8 tipos)
      ↓
Confirmação do tipo com o solicitante
      ↓
Enumeração dos itens (decomposição)
      ↓
Confirmação da lista de itens
      ↓
Coleta profunda (perguntas compartilhadas → exceções por item)
      ↓
Validação de completude + avisos
      ↓
Confirmação final
      ↓
Geração de N briefings individuais
      ↓
Envio dos IDs para o ciclo Huggs
```

---

## 8 Tipos de Demanda Suportados

| # | Tipo | Exemplos reais (base Asana) |
|---|------|-----------------------------|
| 1 | **Material PDV** | Enxoval Hello Kitty PDV, Wobbler Melu, Vitrine Lilly Perfumaria |
| 2 | **Embalagem** | Displays Blow (21 SKUs), Cartuchos Hello Kitty, Etiquetas Classic |
| 3 | **Evento** | Beauty Show Ruby Rose, Beauty Show Melu, Ativações 2026 |
| 4 | **Campanha / KV** | Copa do Mundo 2026, Dia das Mães, Lançamento Linha Pistache |
| 5 | **E-commerce** | Union Maio 2026, Banners Marketplace, Email Marketing |
| 6 | **Press Kit** | Rótulo Presskit Pistache, Kit Influencer We|Melu |
| 7 | **Catálogo / Book** | Book Trade China, Guia de Lançamento Melu Corporal |
| 8 | **Material Interno** | Flyer Dia das Mães, Arte Elevador, Organograma |

---

## Princípio Central: 1 Item = 1 Task = 1 Briefing

Uma única demanda do solicitante pode gerar múltiplos itens. O agente decompõe **antes** de coletar detalhes, garantindo que cada briefing gerado seja atômico, autocontido e pronto para entrar no fluxo Huggs de forma independente.

### Exemplo de Decomposição Real

**Demanda:** "Preciso de materiais PDV para a linha Hello Kitty, 3 modelos de cada"

**Decomposição pelo agente:**

| Item | Briefing gerado |
|------|----------------|
| 1 de 9 | Wobbler — Hello Kitty — Ruby Rose (×3 versões) |
| 2 de 9 | Faixa de Gôndola — Hello Kitty — Ruby Rose (×3 versões) |
| 3 de 9 | Régua de Gôndola — Hello Kitty — Ruby Rose (×3 versões) |
| 4 de 9 | Display de Rolo — Hello Kitty — Ruby Rose (×3 versões) |
| 5 de 9 | Clip Strip — Hello Kitty — Ruby Rose (×3 versões) |
| 6 de 9 | Cubo Promocional — Hello Kitty — Ruby Rose (×3 versões) |
| 7 de 9 | Stopper — Hello Kitty — Ruby Rose (×3 versões) |
| 8 de 9 | Display de Balcão — Hello Kitty — Ruby Rose (×3 versões) |
| 9 de 9 | Totem — Hello Kitty — Ruby Rose (×3 versões) |

**Total: 9 briefings individuais, todos com KV compartilhado, prazo compartilhado e dimensões específicas por peça.**

> Dado real: tarefa `ENXOVAL HELLO KITTY - PDV` (gid 1214634079578356) gerou exatamente 9 subtarefas com esse padrão.

---

## Base de Dados

Este agente foi especificado a partir de análise de:
- **626 tarefas ativas** em 12 projetos Asana da Ruby Rose
- **1.847+ subtarefas** mapeadas
- **17 solicitantes únicos** identificados
- **375 tarefas com subtarefas** (padrões de decomposição)

---

## Equipes e Solicitantes Mapeados

| Equipe | Solicitantes principais |
|--------|------------------------|
| **Trade Marketing** | Ronaldo Alves Simões, Mirella Mota, Paloma Baram, Jessika Marcondes Mundel |
| **Produto** | Luana do Nascimento Bazilio, Isabella Moraes, Daniele Silva, Saynara dos Santos de Freitas |
| **Marketing** | Paloma Baram, Aldry Araujo, Natasha Figueredo de Lima |
| **Comercial** | Nathalia Oliveira |

---

## Documentos desta Pasta

| Arquivo | Conteúdo |
|---------|----------|
| `00-visao-geral.md` | Este documento — visão geral do agente |
| `01-fluxo-de-conversa.md` | Fluxo completo das 4 fases da conversa |
| `02-perguntas-por-tipo.md` | Árvores de perguntas para os 8 tipos de demanda |
| `03-estrutura-briefing.md` | Estrutura do briefing individual gerado |
| `04-regras-decomposicao.md` | Como 1 demanda vira N briefings |
| `05-prompt-sistema.md` | Prompt completo para o modelo de IA |
| `06-skills.md` | Skills por tipo de demanda |
| `07-exemplos-conversa.md` | 3 conversas completas com o agente |
