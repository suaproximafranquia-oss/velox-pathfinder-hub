# Portal Leads — universo completo sem criar operação

## Escopo
- Alterar somente a listagem do Portal Leads da Financeira `/f`.
- Manter `crm_leads` como universo canônico do GreenSales e `portal_leads` como card operacional.
- Não alterar sincronização, corte, E0–E8, R/RE, compromissos, fila ou Ação do Dia.

## Implementação
- Remover da consulta do Portal Leads o filtro que hoje limita `crm_leads` aos IDs já existentes em `portal_leads`.
- Paginar a leitura do espelho para não truncar o universo no limite atual de 500 registros.
- Anexar a cada lead somente a informação de existência e responsável do card operacional, sem inserir ou atualizar dados.
- Na tela, preservar o comportamento atual dos cards operacionais e impedir controles operacionais para leads que existem apenas no espelho.
- Manter busca, etapas, permissões e atualização automática existentes.

## Validação
- Adicionar testes direcionados para universo completo, merge por `external_id`, paginação e ausência de efeitos operacionais.
- Conferir no banco as contagens de `crm_leads`, `portal_leads`, duplicidades, filas e cadências antes/depois.
- Executar testes focados e confirmar a compilação automática.
