

# Reorganizar Impostos no Plano de Contas v2 — Federal, Estadual, Municipal

## Situação Atual

O grupo **2.4 IMPOSTOS E TRIBUTOS** está desativado e os impostos ativos estão "soltos":
- `2.4.2.1` Tributos Estaduais (ativo)
- `2.4.4` IRPJ, `2.4.5` CSLL, `2.4.6` COFINS, `2.4.7` PIS (ativos — todos federais)
- Não existe nenhuma conta para **impostos municipais** (ISS, IPTU, taxas)

Faltam também: Simples Nacional (inativo), ICMS sobre Vendas (inativo).

## Proposta — Nova estrutura do grupo 2.4

```text
2.4   IMPOSTOS E TRIBUTOS (grupo, reativar)
├── 2.4.1  Impostos Federais (grupo novo)
│   ├── 2.4.1.1  IRPJ
│   ├── 2.4.1.2  CSLL
│   ├── 2.4.1.3  COFINS
│   ├── 2.4.1.4  PIS
│   ├── 2.4.1.5  IOF  (mover de 3.1.30)
│   └── 2.4.1.6  Simples Nacional
├── 2.4.2  Impostos Estaduais (grupo novo)
│   ├── 2.4.2.1  ICMS sobre Vendas
│   └── 2.4.2.2  Outros Tributos Estaduais
└── 2.4.3  Impostos Municipais (grupo novo)
    ├── 2.4.3.1  ISS
    └── 2.4.3.2  Outros Tributos Municipais
```

## Mudanças

### Migração SQL

1. **Reativar** `2.4 IMPOSTOS E TRIBUTOS` como grupo
2. **Criar** 3 sub-grupos: `2.4.1 Impostos Federais`, `2.4.2 Impostos Estaduais`, `2.4.3 Impostos Municipais`
3. **Renumerar** contas ativas para encaixar na hierarquia:
   - `2.4.4 IRPJ` → `2.4.1.1`
   - `2.4.5 CSLL` → `2.4.1.2`
   - `2.4.6 COFINS` → `2.4.1.3`
   - `2.4.7 PIS` → `2.4.1.4`
   - `3.1.30 IOF` → `2.4.1.5` (mover do grupo de despesas fixas para federais)
   - Reativar Simples Nacional como `2.4.1.6`
   - `2.4.2.1 Tributos Estaduais` renomear para "Outros Tributos Estaduais" (`2.4.2.2`)
   - Reativar ICMS sobre Vendas como `2.4.2.1`
4. **Criar** contas municipais: `2.4.3.1 ISS`, `2.4.3.2 Outros Tributos Municipais`
5. **Atualizar** `plano_contas_migracao` com os novos códigos
6. **Desativar** códigos antigos que foram movidos

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Reorganizar grupo 2.4 com sub-classificação federal/estadual/municipal |

