# Detalhamento do Plano de Contas — 4 Categorias

## Diagnóstico com Dados Reais

### 1. Embalagens (`2.2` — conta única, R$ 2,1M, 761 títulos)
- Hoje: tudo em "Embalagens e Materiais para postagem" (conta analítica única)
- **Problema**: Não diferencia primária (caixa, saco), secundária (fita, proteção), terciária (palete, stretch) e materiais de postagem
- **Ação**: Transformar `2.2` em **grupo** e criar sub-contas:

| Código | Nome | Descrição |
|---|---|---|
| 2.2 | Embalagens *(vira grupo)* | — |
| 2.2.1 | Embalagem Primária | Caixas, sacos, sacolas, envelopes |
| 2.2.2 | Embalagem Secundária | Fitas, plástico bolha, proteção interna |
| 2.2.3 | Embalagem Terciária | Paletes, stretch film, cintas |
| 2.2.4 | Materiais de Postagem | Etiquetas, lacres, materiais de envio |

### 2. Aluguéis (`3.1.1` — já tem 2 sub-contas, falta 1)
- `3.1.1.1 Depósito` → R$ 4,5M, 169 títulos ✓
- `3.1.1.2 Escritório` → R$ 469k, 63 títulos ✓
- `3.1.24 Locação de itens (informática)` → R$ 147k (equipamentos, já separado) ✓
- **Faltante**: Aluguel de **espaços operacionais** (showroom, ponto de venda, espaço para eventos)
- **Ação**: Criar 1 sub-conta:

| Código | Nome | Descrição |
|---|---|---|
| 3.1.1.3 | Outros Espaços Operacionais | Showroom, PV, espaço temporário |

### 3. Seguros (`3.1.11` — conta única, R$ 250k, 126 títulos em 5 categorias ERP)
- Hoje: tudo em "Seguro" genérico (exceto `2.4.5 Seguro da Mercadoria` que já está separado ✓)
- Categorias ERP identificadas: SEGURO DEPOSITO (34), SEGURO BENS (3), SEGUROESCRITORIO (2), SEGURO DE PESSOAL (21 → já em 3.2.12.2 ✓)
- **Ação**: Transformar `3.1.11` em **grupo** e criar sub-contas:

| Código | Nome | Dept | Mapeamento ERP |
|---|---|---|---|
| 3.1.11 | Seguros *(vira grupo)* | — | — |
| 3.1.11.1 | Seguro de Galpão/Depósito | Logística | SEGURO DEPOSITO |
| 3.1.11.2 | Seguro de Escritório | Administrativo | SEGUROESCRITORIO |
| 3.1.11.3 | Seguro de Bens e Equipamentos | Operações | SEGURO BENS |
| 3.1.11.4 | Seguro de Veículos | Logística | (futuro) |

*Nota: SEGURO DE PESSOAL já está corretamente em `3.2.12.2` (RH). SEGURO DE TRANSPORTE já está em `2.4.5`.*

### 4. Tarifas Bancárias (`2.7` — só tem Mercado Pago, R$ 321k, 1.388 títulos)
- Fornecedores identificados: **Banco Itaú** (907 títulos, R$ 160k), **Banco Bradesco** (365 títulos, R$ 18k), **Mercado Pago** (49 títulos, R$ 2,4k), outros (67 títulos)
- **Ação**: Criar sub-contas por banco principal + genérica:

| Código | Nome | Mapeamento (fornecedor) |
|---|---|---|
| 2.7.1 | Mercado Pago *(já existe)* | MERCADO PAGO PR |
| 2.7.2 | Banco Itaú | BANCO ITAÚ, ITAU SAO PAULO |
| 2.7.3 | Banco Bradesco | BANCO BRADESCO, BRADESCO |
| 2.7.4 | Tarifas Bancárias Diversas | Demais bancos e instituições |

---

## Reclassificação de Títulos Existentes

Após criar as sub-contas, os ~1.388 títulos de TARIFAS BANCARIAS serão redistribuídos por fornecedor. Os 34 títulos de SEGURO DEPOSITO serão movidos para `3.1.11.1`. Os 761 títulos de EMBALAGENS permanecerão temporariamente em `2.2.1` (Primária) como default até classificação manual futura.

---

## Resumo

| Grupo | Contas Novas | Títulos Afetados |
|---|---|---|
| Embalagens (2.2) | 4 sub-contas | 761 (default → 2.2.1) |
| Aluguéis (3.1.1) | 1 sub-conta | 0 (futuro) |
| Seguros (3.1.11) | 4 sub-contas | ~39 reclassificados |
| Tarifas (2.7) | 3 sub-contas | ~1.388 redistribuídos |
| **TOTAL** | **12 contas** | **~2.188 títulos** |
