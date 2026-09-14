# E0 única etapa com duas ligações

## Objetivo
Remover apenas as segundas ligações automáticas de E1/E2 e a compensação E1→E2. A E0 permanece exatamente como está.

## Implementação
- Simplificar o plano de E1 e E2 para `Ligação → Mensagem`, mantendo ações/cards separados.
- Retirar do motor existente a criação, espera de 2 horas, expiração e transporte das tentativas adicionais de E1/E2.
- Manter intactos plano, contextos, atendimento e regra de segunda-feira da E0.
- Confirmar que E3+ conserva seus planos atuais e nunca ganha ligação adicional.
- Reconciliar somente ações antigas E1 ordem 2 e E2 ordem 3 do tipo ligação em estado pendente/processando; preservar executadas, canceladas, mensagens e histórico.

## Validação
- Cobrir E0 intacta; E1/E2 com uma ligação e mensagem; ausência de compensação; histórico preservado; E3+ sem regressão.
- Executar testes focados, verificação de tipos, compilação e inspeção da Ação do Dia.

## Limites técnicos
- Patch restrito ao plano/resolvedor atual, ao orquestrador que criava adicionais, ao reconciliador focado e aos testes correspondentes.
- Sem mudanças em mensagens, Biblioteca, estágios, transições, datas entre etapas, domínio, autenticação, GreenSales, Portal, R/RE ou agendamentos.