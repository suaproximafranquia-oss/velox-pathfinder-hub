# Liberação temporária da Ação do Dia no domingo

## Escopo

- Alterar somente a execução manual da Ação do Dia da Financeira (`/f`).
- Preservar integralmente calendário, fila, prioridades, ações futuras, cadência, reentrada, CRM e histórico.
- Não alterar `resolveOperationalWindow`, dados ou estrutura do banco.

## Implementação

- Criar uma verificação isolada de liberação temporária válida apenas em 13/09/2026, no fuso `America/Sao_Paulo`.
- Aplicar essa verificação somente ao bloqueio visual de execução da Ação do Dia real.
- Considerar a liberação válida desde o início do dia até antes de 14/09/2026 00:00:00 em São Paulo, expirando automaticamente após 13/09/2026 23:59:59.
- Manter a lista e a classificação das ações exatamente como chegam da fila oficial, sem tornar ações futuras executáveis.

## Validação

- Testar domingo dentro da liberação, instante de expiração e domingo comum fora da data autorizada.
- Confirmar que a regra permanente continua fechando domingos após a expiração.
- Verificar compilação e testes direcionados.
