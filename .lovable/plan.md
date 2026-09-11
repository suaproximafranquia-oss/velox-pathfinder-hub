# Diagnóstico cirúrgico — `step_context` na publicação da Biblioteca

## Objetivo
Explicar exatamente por que a publicação de “AAA” foi recusada, sem alterar código, banco, Biblioteca ou publicação.

## Investigação
1. Confirmar a definição vigente do constraint `relationship_message_library_step_context_check` no banco e a migration que o criou.
2. Mapear as combinações etapa + contexto aceitas atualmente pela interface e pela validação server-side.
3. Rastrear o payload desde a etapa/contexto selecionados no formulário até `publicarVersaoMensagem`, `publishLibraryVersion` e o `INSERT` em `relationship_message_library`.
4. Comparar os contextos aceitos pelo código com os contextos aceitos pelo constraint, identificando a incompatibilidade exata.
5. Verificar registros e logs disponíveis para identificar a etapa escolhida na tentativa de publicar “AAA”; se a tentativa rejeitada não tiver deixado evidência persistida, marcar etapa e payload daquela requisição como **NÃO CONFIRMADO** e separar isso do comportamento determinístico comprovado no código.
6. Distinguir os caminhos de criar etapa, publicar nova versão e editar identidade/versão existente.

## Entrega
- A — etapa que estava sendo publicada.
- B — `step_context` enviado.
- C — valores permitidos pelo constraint.
- D — função que monta o payload.
- E — payload que chega ao banco.
- F — causa exata do erro.
- G — menor correção necessária, sem implementar.

## Evidência já confirmada
- O constraint vigente aceita somente `NULL`, `SEM_CONTATO` ou `MATERIAL_ENVIADO`.
- O código atual também modela `V2`, `V3`, `NAO_CHEGOU_E4` e `JA_PASSOU_E4` para combinações específicas; esses valores não cabem no constraint vigente.
- A tentativa com “AAA” não criou linha no banco, e os logs disponíveis não registram o payload rejeitado.

## Restrições
- Nenhuma alteração de código, migration, banco, Biblioteca, contexto, etapa, cadência, motor, fila, Ação do Dia ou deploy.
- Nenhuma auditoria fora do fluxo de publicação e do constraint informado.