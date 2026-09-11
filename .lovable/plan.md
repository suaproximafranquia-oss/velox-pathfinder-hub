# Diagnóstico final — incompatibilidade de contextos da Biblioteca

## Objetivo
Determinar a incompatibilidade exata entre os contextos especiais definidos pelo código e o constraint vigente de `relationship_message_library.step_context`, sem alterar código, banco, migrations, Biblioteca ou publicação.

## Investigação
1. Confirmar a definição vigente do constraint `relationship_message_library_step_context_check` e todas as migrations que o criaram ou alteraram.
2. Mapear a definição oficial de contextos em `operational-steps.ts` e a resolução de E2/V2, E3/V3 e dos dois contextos de R3.
3. Rastrear o payload desde o formulário até `publicarVersaoMensagem`, `publishLibraryVersion` e o `INSERT` em `relationship_message_library`.
4. Registrar exatamente os valores enviados em E2/V2, E3/V3, R3/NAO_CHEGOU_E4 e R3/JA_PASSOU_E4.
5. Comparar a lista fechada do código com a lista fechada aceita pelo banco e explicar por que E7/E8 publicam normalmente.
6. Classificar a causa entre código incorreto, constraint desatualizado ou regra de modelagem distinta.
7. Avaliar as alternativas arquiteturais A–D sem implementar nem escolher uma flexibilização genérica.

## Entrega
- A — constraint atual.
- B — contextos definidos pelo código.
- C — payload de V2, V3 e dos dois contextos de R3.
- D — diferença exata entre código e banco.
- E — por que E7/E8 funcionam.
- F — causa raiz.
- G — solução arquitetural correta entre A–D, sem implementar.
- H — arquivos e migrations que seriam alterados.

## Evidência já confirmada
- O constraint vigente aceita somente `NULL`, `SEM_CONTATO` ou `MATERIAL_ENVIADO`.
- O código atual também modela `V2`, `V3`, `NAO_CHEGOU_E4` e `JA_PASSOU_E4` para combinações específicas; esses valores não cabem no constraint vigente.
- A validação manual confirmou falha em E2/V2, E3/V3 e R3, e sucesso em E7/E8 nos dois contextos aceitos e em R4 com contexto `NULL`.
- A busca de migrations encontrou somente a criação do constraint com a lista antiga; nenhuma migration posterior o alterou.

## Restrições
- Nenhuma alteração de código, migration, constraint, banco, Biblioteca, contexto, etapa ou deploy.
- Nenhuma investigação ou recomendação sobre cadência, motor, fila, Ação do Dia, GreenSales, Portal ou Workspace.
- Não recomendar liberar strings arbitrárias, remover validações, criar contextos ou mudar E2/E3/R3/E7/E8.