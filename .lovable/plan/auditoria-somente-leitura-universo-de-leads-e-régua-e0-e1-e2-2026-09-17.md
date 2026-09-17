# Auditoria somente leitura — universo de leads e régua E0/E1/E2

## Objetivo e limites

Produzir uma fotografia auditável do estado atual entre **12/09/2026 e 17/09/2026**, confrontando entrada, identidade, ciclo, histórico, execução, fila persistida e elegibilidade para a Ação do Dia.

- Somente consultas `SELECT` e leitura do código vigente.
- Nenhuma alteração de código, banco, fila ou lead.
- Nenhum reprocessamento, tick, reconciliação, materialização, migração, publicação ou deploy.
- A lista visual não será tratada como fonte de verdade; a visibilidade será reconstruída a partir das fontes persistidas e dos filtros atuais.
- A fotografia será calculada na data operacional de **17/09/2026**, registrando o horário exato da consulta.

## Estado já confirmado

- O recorte contém **50 linhas reais em `crm_leads`** e **50 em `portal_leads`**; há **47 identidades canônicas vinculadas**, além de divergências que serão classificadas individualmente para evitar dupla contagem.
- A fila operacional vigente está em `relationship_queue`; não há tarefas E0/E1/E2 recentes em `crm_cadence_tasks`, que será mantida na conferência como fonte legada/comparativa.
- SURAMA foi identificada de forma única pelo vínculo canônico entre o registro GreenSales e o card `gs_59364`; sua linha do tempo será auditada integralmente.
- A implementação vigente usa E0→E1 `+1` e E1→E2 `+2`, com soma direta e posterior ajuste do calendário operacional.

## Método

### 1. Construir o universo canônico

- Extrair os leads cuja entrada operacional ocorreu entre 12/09 e 17/09, usando os campos de entrada realmente aplicáveis em cada origem.
- Cruzar `crm_leads` e `portal_leads` por identidade canônica, identificadores externos e card GreenSales.
- Deduplicar por investidor sem ocultar registros divergentes.
- Classificar origem, responsável, estágio atual, situação de teste, encerramento, arquivamento, descadastro, duplicidade e reentrada.
- Separar os totais por sábado, domingo, segunda, terça, quarta e quinta.

### 2. Reconstruir a trajetória real de cada lead

Para cada identidade do universo:

- Ler `workspace_e0_actions`, `relationship_cadences`, `relationship_queue`, `relationship_events`, `crm_lead_events`, `crm_timeline` e `crm_cadence_tasks` quando houver vínculo aplicável.
- Determinar fluxo E, R ou RE, primeira etapa criada, ações internas da etapa, última etapa legitimamente concluída e horário real de execução.
- Diferenciar `PENDING`, `PROCESSING`, `EXECUTED`, cancelamento legítimo, neutralização histórica, ação pulada, ciclo encerrado e obrigação nunca materializada.
- Verificar sequências incompatíveis, especialmente E2 existente sem E1 integralmente executada.

### 3. Recalcular somente para conferência

- Aplicar em memória a regra atual de `cadence-v2.ts`, sem gravar resultados.
- Usar a última execução real como âncora: E0→E1 `+1`; E1→E2 `+2`.
- Calcular primeiro a data teórica e depois aplicar exatamente o calendário operacional vigente, incluindo sábado, domingo e feriados.
- Comparar data teórica, data operacional esperada, `theoretical_date` e `due_at` persistidos.
- Não antecipar E1/E2 quando a etapa anterior não foi integralmente executada.

### 4. Reconstruir a elegibilidade da Ação do Dia

- Reproduzir apenas por leitura os filtros atuais de `buildDailyActions()`: fila de produção, sem rodada de homologação, status pendente/em atendimento, obrigação liberada e vencida, ciclo operacional, card existente, responsável aplicável, não arquivado e não encerrado.
- Separar “não aparece legitimamente” de “deveria aparecer e não aparece”.
- Apontar obrigações futuras, puladas no dia, internas ainda não liberadas, congeladas por estágio/compromisso, ciclos históricos e divergências de responsável.
- Apresentar resultados por responsável executivo quando essa restrição afetar a visibilidade.

### 5. Classificar E0, E1 e E2

Por data de entrada e por lead:

- **E0:** total elegível, chegou à etapa, executou, permanece nela, deveria ter E1 e possui E1.
- **E1:** executada corretamente, na fila, atrasada, futura, ausente apesar de devida, salto para E2, exclusão legítima ou outro motivo comprovado.
- **E2:** mesma classificação, usando somente leads com E1 realmente concluída.
- Para segunda, terça e quarta, calcular quantos deveriam estar em E2 hoje e explicar individualmente cada diferença.

### 6. Auditar SURAMA

Montar uma linha do tempo única contendo:

- identidade, entrada, estágio e ciclo;
- todas as ações E0 e seus resultados;
- criação e execução integral da E1;
- criação, data teórica e vencimento da E2;
- motivo pelo qual a E2 está elegível hoje;
- pesquisa de ausência de E1, duplicidade, exclusão, descadastro e reentrada.

## Relatório final

Entregar:

1. **Resumo executivo** com universo canônico e contagens esperadas/reais em E0, E1 e E2.
2. **Tabela por data de entrada**: Data | Entradas | E0 executada | E1 esperada | E1 existente | E2 esperada | E2 existente | Exceções.
3. **Leads faltantes**, um por linha, com entrada, última execução, próxima etapa/data esperada, estado atual e motivo comprovado.
4. **Avanços incompatíveis**, incluindo qualquer E2 sem E1 válida.
5. **Atrasos**, incluindo obrigações vencidas persistidas como futuras ou ausentes.
6. **SURAMA**, com linha do tempo completa e explicação técnica.
7. **Conclusão A–F**, respondendo SIM/NÃO e citando a evidência quantitativa de cada resposta.
8. **Anexo de rastreabilidade** com as regras do código e os campos/tabelas usados, para que cada classificação possa ser conferida.

## Critério de conclusão

A auditoria só será encerrada após reconciliar os totais do universo canônico com todas as categorias de destino, sem contar o mesmo investidor duas vezes e sem deixar diferenças sem motivo documentado.
