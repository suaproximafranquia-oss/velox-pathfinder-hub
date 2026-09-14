# Lapidações finais da Financeira `/f`

## Objetivo
Aplicar somente os ajustes pontuais solicitados, preservando o motor, os fluxos já fechados e todos os módulos fora do escopo.

## Implementação

1. **NOVO de atividade do Portal**
   - Manter o alerta e o `viewed_at` inalterados ao abrir ficha/card.
   - Resolver a atividade apenas no clique em **Concluído**, usando a conclusão server-side já existente.
   - Propagar o estado retornado pelo servidor pelo evento oficial de status, para remover o selo NOVO imediatamente na mesma aba e nas demais, sem F5.
   - Não alterar o NOVO originado pela entrada de um lead novo.

2. **Primeira R1 após AGENDAMENTOS/VÍDEO → FRIOS**
   - Alterar apenas a primeira decisão do fluxo R para usar o próximo dia operacional como data mínima.
   - Reutilizar o calendário operacional existente, mantendo a fila, a instância, os eventos e as proteções contra duplicidade.
   - Não mudar R2–R5 nem recalcular histórico executado.

3. **Acesso aos módulos do Portal**
   - Deixar **Manual** e **Simulador** sempre acessíveis após a sessão oficial reconhecida.
   - Condicionar somente **Material Institucional** à conclusão oficial persistida do Manual.
   - Reutilizar `portal_released_at/by/reason` para a liberação manual permanente do Material, com controle administrativo na ficha e estado refletido em qualquer navegador.
   - Exibir no Material bloqueado um aviso específico orientando a conclusão do Manual; os demais módulos não herdarão esse bloqueio.

4. **Link personalizado**
   - Manter a rota personalizada da Financeira direcionando para a Home com intenção de abrir o Manual.
   - Garantir que a abertura automática preserve os parâmetros existentes, a identidade, o responsável e a sessão reconhecida, sem trocar domínio ou fluxo de autenticação.

5. **Contexto E0**
   - Fixar o contexto pelo resultado da primeira ligação: `SIM → CONTATO_REALIZADO` e `NAO → SEM_CONTATO`.
   - Permitir a oferta de cópia após `SIM` na primeira ligação também na segunda-feira.
   - Nunca oferecer confirmação de cópia na segunda ligação; preservar integralmente a régua vigente, suas esperas, filas, histórico e idempotência.

6. **Central dos Nomes**
   - Não armazenar resultados negativos no cache em memória.
   - Manter o cache positivo atual, permitindo que um nome importado depois de uma consulta ausente seja encontrado na tentativa seguinte.

## Validação
- Adicionar/ajustar testes focados para atualização imediata do NOVO, primeiro R1 no próximo dia operacional, bloqueio/liberação permanente do Material, link personalizado, contextos da E0 e cache de nomes.
- Executar testes focados, verificação de tipos e build pelo fluxo automático do projeto.
- Validar em preview `/f`, link personalizado, Manual, Simulador, Material e Ação do Dia, sem exigir recarga.

## Limites técnicos
- Sem refatoração do motor e sem arquitetura paralela.
- Sem alterações em E2, E3+, R2–R5, RE, GreenSales, Portal Leads, autenticação, domínio, hospedagem ou segurança.
- Sem reescrever histórico executado ou criar duplicatas/carryover.
