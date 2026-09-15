# Comando D — núcleo da Ação do Dia /f

## Objetivo
Simplificar o motor oficial para uma ligação seguida da mensagem na mesma etapa e no mesmo card, reforçando validade comercial, relógio real e reconciliação integral da fila sem criar arquitetura paralela.

## Implementação
- Alterar o plano oficial das etapas E0–E4 e equivalentes já existentes com ligação+mensagem para exatamente `Ligação → Mensagem`, removendo a espera de 10 minutos e qualquer geração de segunda ligação.
- Acrescentar uma reconciliação idempotente e auditável que cancele com `single_call_rule` somente segundas ligações antigas ainda abertas; registros executados e demais históricos permanecem intactos.
- Fazer o resultado da ligação registrar o evento oficial e transformar o card atual na continuação de mensagem, sem reselecionar a fila. A versão ativa da Biblioteca será resolvida automaticamente pelo serviço existente: E0 por SIM/NAO, E2/E3 por V0 e E7 pelo histórico material.
- Concluir a etapa somente no botão `Concluído` da mensagem; a gravação usa a linha oficial da mensagem na `relationship_queue`, preservando `actionKey`, claims, auditoria e proteção contra respostas antigas.
- Tornar ZERO_CONTATO e FRIO o corredor normal; manter somente a exceção da E0 inicial em NOVO. AGENDAMENTOS, VIDEO, OPORTUNIDADE, COF/CONTRATO, PAGAMENTO, REMARKETING, VENCEMOS e FINALIZADO neutralizam pendências incompatíveis sem depender de `follow_up`.
- Reutilizar o mecanismo R existente quando houver retorno elegível a FRIO, mantendo seu nascimento na próxima janela operacional.
- Fazer cada leitura oficial — inclusive o único ciclo silencioso de 60 segundos já existente — reconciliar todas as pendências antes de devolver a fotografia completa. A interface substituirá a lista inteira, preservando PROCESSING válido, o card atual quando ainda válido e a proteção de versão contra respostas atrasadas.
- Reancorar E1, E2, E3 e E4 na execução real da etapa anterior, respectivamente em +1, +2, +2 e +2 dias operacionais; atualizar a obrigação futura aberta quando a âncora atrasar, sem duplicar nem alterar EXECUTED.
- Na Agenda existente, classificar slots passados do dia como `INDISPONÍVEL`, mantendo compromisso como `OCUPADO` e demais horários atuais/futuros como `LIVRE`.

## Validação
- Cobrir uma ligação em E0–E4; continuidade SIM/NAO da E0 no mesmo card; V0 invisível e contextos E2/V2, E3/V3 e E7.
- Cobrir todos os estágios permitidos/congeladores, retorno a FRIO via R, neutralização em lote, PROCESSING, stale responses e ausência de ressurreição.
- Cobrir relógio pela execução real, atualização determinística de pendência futura e ausência de acúmulo no mesmo dia.
- Cobrir os três estados visuais da Agenda.
- Executar testes focados e relacionados ao motor, verificação de tipos, build automático e inspeção do Preview em `/f`, `/f/executivo`, Ação do Dia, ligação, mensagem e Agenda.

## Limites técnicos
- Sem nova tabela, migration, fila, motor, fonte de verdade ou polling.
- Sem alterações em `/s`, `/s/portal`, `/seg`, Portal Solar, WWW/DNS, Reset Operacional, link curto, estrutura da Agenda, conteúdo E4 ou conteúdo da Biblioteca.
- Sem publicação.