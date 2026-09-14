# Diagnóstico do universo de leads da Financeira `/f`

## Objetivo
Explicar, sem qualquer alteração, por que existem 43 registros em `portal_leads` enquanto o espelho GreenSales contém centenas de leads.

## Verificação
1. Rastrear a consulta completa e incremental ao GreenSales, incluindo conta utilizada, status aceitos, paginação, limites e janelas temporais.
2. Identificar a classificação A/B/C/D e os critérios de data, etapa e existência prévia.
3. Separar os três níveis atuais:
   - lead espelhado em `crm_leads`;
   - card operacional em `portal_leads`;
   - obrigação na fila/Ação do Dia.
4. Comparar `runLeadSync`, backfill e importação histórica para determinar quais caminhos criam apenas espelho e quais também criam card.
5. Conferir as contagens atuais por etapa, data e status, inclusive os leads sem card.
6. Verificar o efeito comprovável do marco zero e o comportamento futuro de um lead ausente movido para AGENDAMENTOS ou VÍDEO.

## Entrega
Relatório objetivo com regra atual, funções e arquivos, filtros, escopo afetado, causa dos 43 registros e conclusão SIM/NÃO sobre a regra desejada. Nenhuma correção ou refatoração será proposta.
