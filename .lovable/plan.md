

# Inserir Fornecedores de TI para Análise de Redução

## Análise Realizada

Cruzei os fornecedores da planilha com o banco de dados no departamento **Tecnologia da Informação**. Todos os 32 fornecedores da imagem foram encontrados no sistema, totalizando **R$ 3,09 milhões** em gastos históricos.

### Fornecedores Identificados (por volume)

| Fornecedor | Código | Subcategoria | Total (R$) | Títulos |
|---|---|---|---|---|
| ALLTOMATIZE SISTEMAS | 29 | Software | 1.173.820 | 356 |
| TRYZ TECNOLOGIA | 3529 | Software | 320.000 | 6 |
| LINX SISTEMAS | 257 | Software | 314.847 | 59 |
| LIVE SOFTWARE | 248 | Software/Sites | 299.862 | 81 |
| SCANSOURCE DO BRASIL | 1213 | Hardware | 180.731 | 22 |
| INTERAXA BRASIL | 2683 | Software | 143.137 | 18 |
| BLIP (CURUPIRA S/A) | 3416 | Software | 101.932 | 11 |
| DAWNTECH CONSULTORIA | 3564 | Software | 89.159 | 20 |
| CORTEX INTELLIGENCE | 3185 | Software | 88.000 | 11 |
| SCANSOURCE BRASIL | 251 | Hardware | 84.884 | 10 |
| MUNDIVOX CLOUD | 249 | Provedor | 61.949 | 78 |
| LIVEXA DIGITAL | 3368 | Software | 37.869 | 20 |
| 2RTI SOLUÇÕES | 1475 | Internet/Manut | 30.025 | 29 |
| PERSIS INTERNET | 155 | Internet/Manut | 27.257 | 109 |
| MUNDIVOX IMPLANTAÇÃO | 1854 | Provedor | 21.717 | 31 |
| WEBMAIS CONEXAO | 1738 | Internet/Manut | 20.921 | 29 |
| MILVUS.COM | 2207 | Software | 16.369 | 21 |
| MUNDIVOX NETWORKS | 708 | Provedor | 13.048 | 18 |
| ALGAR TELECOM | 664 | Internet/Manut | 8.505 | 38 |
| ÓBVIO BRASIL - RECLAME AQUI | 2856 | Software | 8.340 | 15 |
| PGF TELECOM | 2201 | Internet/Manut | 5.853 | 29 |
| ARQUIVEI SERVIÇOS | 933 | Software | 5.133 | 4 |
| W M DA SILVA SERVIÇOS | 2121 | Câmeras | 3.718 | 1 |
| VANESSA MOREIRA GONCALVES | 606 | Impressoras | 3.330 | 3 |
| RAMALVIRTUAL TELECOM | 3238 | Internet/Manut | 3.180 | 3 |
| DEMERGE BRASIL | 1310 | Sites/Domínio | 1.621 | 4 |
| NEXXERA MERCANTIL | 2822 | Sist. Terceiros | 1.448 | 16 |
| TIM S/A | 20 | Internet/Manut | 851 | 6 |
| VIVO - TELEFONICA | 1806 | Internet/Manut | 817 | 4 |
| VIVO TELEFONICA | 762 | Internet/Manut | 231 | 1 |
| VIP INFORMATICA | 297 | Impressoras | 175 | 1 |

**Não encontrados** (sem gastos registrados no depto TI): SM TONNER, MICHELAND, POWERMAX SEGURANÇA, ALARM FORCE, EVEO S.A, VANESSA MOREIRA-FINAL CNPJ 01-96.

## Plano de Execução

### 1. Migração SQL — Inserir em massa na tabela `contas_pagar_revisao`

Inserir os 32 fornecedores encontrados como itens de revisão com:
- `tipo_revisao`: `'reduzir'`
- `prioridade`: `'media'` (alta para os top 5 por volume)
- `status`: `'pendente'`
- `departamento_id`: ID do departamento "Tecnologia da Informação"
- `valor_atual`: soma dos gastos por fornecedor
- `fornecedor_nome` e `fornecedor_codigo`: dados do sistema
- `observacoes`: "Análise de redução de gastos - Departamento TI"
- `categoria_nome`: subcategoria correspondente (Software, Internet/Manutenção, Provedor, etc.)

### 2. Nenhuma alteração em código

A tela de **Plano de Redução de Gastos** já consome a tabela `contas_pagar_revisao` e exibirá automaticamente os novos registros.

## Arquivos

| Arquivo | Alteração |
|---|---|
| 1 migração SQL | INSERT em massa de ~32 registros em `contas_pagar_revisao` |

