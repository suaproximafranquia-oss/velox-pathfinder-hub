# Correção cirúrgica — Agenda e etapa composta

## Implementação
- Acrescentar 12h e 18h à lista cronológica de horários da Agenda, sem alterar a regra de ocupação.
- Remover do decisor V2 o atalho que considera a etapa concluída somente porque a ligação teve resultado positivo.
- Manter cada etapa composta ativa até que ligação e mensagem estejam executadas ou legitimamente canceladas, preservando o fluxo atual de conclusão conjunta.

## Testes e validação
- Atualizar o teste da Agenda para os dez blocos de 09h a 19h.
- Cobrir E0, E1, E2, E3, E4, E7, R1, R2, RE0, RE1 e RE3 com ligação positiva, mensagem pendente, mensagem concluída e avanço somente após a conclusão.
- Preservar e validar a mensagem específica após resultado negativo e a conclusão composta sem sobra de mensagem.
- Executar somente testes focados, verificação de tipos, build automático e Preview autenticado quando houver sessão.

## Limites
- Sem mudanças em fila, prioridade, claims, polling, reconciliação, datas, conteúdos, integrações, banco ou demais módulos.
- Sem publicação ou deploy.
