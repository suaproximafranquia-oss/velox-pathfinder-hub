# Diagnóstico definitivo — etapas, Biblioteca e janela de domingo (/f)

Somente leitura. Nada foi alterado no código nem no banco.

## 1. CAUSA RAIZ

Nenhuma etapa foi apagada. O que houve foi **edição de títulos sem troca da chave técnica**, entre 29/08 e 05/09, feita pelo usuário thiago.rodrigues. Os textos oficiais do Word foram migrados para as chaves do motor e as linhas de origem ficaram como resíduo; ao mesmo tempo, títulos editoriais ("E4", "R3", "RE0", "RE1", "ER1") foram gravados por cima de chaves diferentes.

Depois, a Biblioteca passou a considerar operacional apenas a chave que existe na configuração do motor. A regra da caixa é exatamente uma: **existe registro na Biblioteca e a chave não está na configuração → "Histórico fora da configuração"**. Não há outra condição (item 12 do pedido: confirmado; a marca vem de `official` no servidor, que testa a chave contra a configuração, e a tela apenas separa os dois grupos).

## 2. INVENTÁRIO COMPLETO (27 chaves na Biblioteca)

| Chave | Título hoje | Família | Config | Motor | Reconhecida | Versões | Ativa | Pos. | Situação | Divergência título×chave |
|---|---|---|---|---|---|---|---|---|---|---|
| E0 | E0 — Primeiro contato | E | Sim | Sim | Sim | 6 | v6 | 10 | Operacional | Não |
| E1 | E1 — Primeiro acompanhamento | E | Sim | Sim | Sim | 5 | v5 | 20 | Operacional | Não (já teve "E2") |
| E3 | E2 — Segundo acompanhamento | E | Sim | Sim | Sim | 4 | v4 | 30 | Operacional | Sim |
| E12 | E3 — Terceiro acompanhamento | E | Sim | Sim | Sim | 4 | v4 | 40 | Operacional | Sim |
| E4 | R2 — Segundo reengajamento | E | Sim | Sim | Sim | 2 | v2 | 90 | Operacional | Sim |
| E30 | E30 — Recontato tardio | E | Sim (travada) | Sim | Sim | 1 | nenhuma | 210 | Operacional, slot vazio | Não |
| E0_V1 | Livre | E | Sim | Sim | Sim | 6 | v6 | 220 | Operacional | Sim (título genérico) |
| E20 | E6 — Acompanhamento da apresentação digital | especial | Sim | Sim | Sim | 3 | v3 | 60 | Operacional | Sim (E6 = rótulo oficial de E20) |
| E27 | E7 — Última tentativa de contato | especial | Sim | Sim | Sim | 3 | v3 | 70 | Operacional | Sim (E7 = rótulo oficial de E27) |
| FINALIZACAO | RE2 — Reentrada / suporte | especial | Sim | Sim | Sim | 2 | v2 | 110 | Operacional | Sim |
| RESPOSTA_AUTOMATICA | Liberado para novas mensagem | especial | Sim | Sim | Sim | 2 | v2 | 170 | Operacional | Sim |
| R1 | RE3 — Finalização / oferta digital | R | Sim | Sim | Sim | 2 | v2 | 120 | Operacional | Sim |
| R2 | RF0 — Follow-up de reunião | R | Sim | Sim | Sim | 2 | v2 | 130 | Operacional | Sim |
| R3 | RF1 — Finalização / alternativa digital | R | Sim | Sim | Sim | 2 | v2 | 140 | Operacional | Sim |
| RE0 | E5 — Apresentação Digital | RE | Sim | Sim | Sim | 5 | v5 | 50 | Operacional | Sim |
| RE1 | E8 — Finalização | RE | Sim | Sim | Sim | 3 | v3 | 80 | Operacional | Sim |
| RE2 | R4 — Finalização do Reengajamento | RE | Sim | Sim | Sim | 3 | v3 | 100 | Operacional | Sim |
| RE3 | ER0 - Etapa de RMK 0 | RE | Sim | Sim | Sim | 3 | v3 (corpo "TESTE") | 150 | Operacional | Sim |
| RF0 | Liberado para novas mensagem | RF | Sim | Sim | Sim | 2 | v2 | 180 | Operacional | Sim |
| RF1 | Liberado para novas mensagem | RF | Sim | Sim | Sim | 2 | v2 | 190 | Operacional | Sim |
| V3 | Liberado para novas mensagem | V | Sim | Sim | Sim | 2 | v2 | 200 | Operacional | Sim |
| V4 | ER2 - Etapa de RMK 2 | V | Sim | Sim | Sim | 3 | v3 (corpo "TESTE") | 160 | Operacional | Sim |
| E2 | E4 — Oferta de apresentação digital | E | **Não** | Não | Só por histórico | 2 | v2 | 50 | Fora da configuração | Sim |
| E5 | R3 — Oferta de apresentação digital | E | **Não** | Não | Só por histórico | 3 | v3 | 110 | Fora da configuração | Sim |
| E6 | RE0 — Reentrada | E | **Não** | Não | Só por histórico | 3 | v3 | 130 | Fora da configuração | Sim |
| E7 | RE1 — Reentrada / conteúdo | E | **Não** | Não | Só por histórico | 2 | v2 | 140 | Fora da configuração | Sim |
| TESTE | ER1 - Etapa de RMK 1 | outro | **Não** | Não | Só por histórico | 2 | v2 ("TESET") | 200 | Fora da configuração | Sim |

Envios reais registrados existem apenas para E0 (37), E3 (6), E1 (3), E20 (2), FINALIZACAO (2), E27 (1). Fila e ciclos não têm nenhuma das cinco chaves fora da configuração — restaurá-las não afeta operação em curso.

## 3. AS CINCO FORA DA CONFIGURAÇÃO

- **E2** — v1 (29/08, "Word oficial", desativada, nota explícita: "numeração editorial do documento; o conteúdo oficial passou para a etapa técnica correspondente"), v2 ativa editada por Thiago: "Quero te oferecer uma alternativa para conhecer melhor a Velox…". É a mensagem de oferta de apresentação digital. Existe E4 oficial separada, mas hoje E4 guarda um texto de reengajamento. Destino provável: E20 (apresentação digital) ou E4 — **INCONCLUSIVO — precisa de decisão do administrador.**
- **E5** — 3 versões; v1 Word desativada com a mesma nota; v3 ativa (31/08): "percebi que a nossa conversa acabou ficando sem continuidade…". Conteúdo de encerramento de reengajamento; candidato natural é R3. **Inferência, não comprovada.**
- **E6** — 3 versões; v1 Word desativada; v3 ativa (31/08): "Vi que você voltou a demonstrar interesse em conhecer a Velox…". Conteúdo é claramente reentrada; candidato: RE0. **Inferência forte, mas RE0 já tem 5 versões com outro texto.**
- **E7** — 2 versões; v1 Word desativada; v2 ativa: "como você voltou a se interessar pelo tema, quero contribuir com…". Candidato: RE1. **Inferência.**
- **TESTE** — criada manualmente em 05/09 pela própria Biblioteca ("Etapa criada pela Biblioteca"), v2 com corpo "TESET". Sem envio, sem fila, sem histórico. Evidência: **registro de teste**, não etapa real.

## 4–8. CONFERÊNCIA CHAVE A CHAVE

- **E0, E0_V1, E1, E3, E4, E12, E20, E27, E30**: existem na configuração e na Biblioteca. **E30 está declarada, porém desativada por trava** e sem texto.
- **E2, E5, E6, E7**: existem só na Biblioteca (resíduo do Word). **E8 não existe em lugar nenhum** — é apenas o título atual de RE1. **E9 a E11, E13 a E19, E21 a E26, E28, E29: não existem** em nenhuma fonte.
- **R0 e R4: não existem** como chave — "R4" é só o título atual de RE2. **R1, R2 e R3 existem** na configuração, no fluxo de reengajamento e na Biblioteca (2 versões cada), mas hoje exibem títulos RE3/RF0/RF1.
- **RE0, RE1, RE2, RE3**: todas existem, são o fluxo de reentrada declarado (RE0→RE1→RE2→RE3) e todas têm mensagens. Nenhuma foi perdida — apenas exibem títulos de outras famílias, o que faz parecer que sumiram.
- **RF0 e RF1 existem** (fluxo "relacionamento esfriado"). **RF2 e RF3 não existem.**
- **ER0, ER1, ER2, ER3: não existem** como etapa em nenhum ponto do motor, da configuração ou do registro de etapas. "ER0" é título sobre RE3, "ER2" é título sobre V4, "ER1" é título sobre a chave TESTE, e "ER3" não aparece. O módulo de Remarketing não usa etapas ER: ele grava o nome do template como passo. Conclusão: **ER foi planejamento e rótulo, nunca etapa oficial.** RE (reentrada) e ER (remarketing por executivo) são conceitos distintos e o sistema não os implementa como iguais — a confusão está apenas nos títulos digitados.
- **V3 e V4** existem (fluxo de visualização) e **FINALIZACAO / RESPOSTA_AUTOMATICA** também, todas oficiais.

Cadeia histórica confirmada: título editorial do Word (E2…E8) → gravado como chave em 29/08 → texto oficial migrado para a chave técnica correspondente → linha de origem desativada com nota → depois o título editorial foi reutilizado sobre outras chaves. É por isso que "E4" mora em `E2` e "E5" em `RE0`.

## 9–11. MENSAGENS, VERSÕES E POSIÇÕES

Nenhuma versão foi perdida: 27 chaves, todas com histórico completo (autor, data, nota). As 12 versões das cinco chaves fora da configuração continuam intactas e podem ser reaproveitadas — em especial os textos ativos de E2, E5, E6 e E7. A posição é atributo da etapa e as versões novas herdam a posição existente; nenhuma linha perdeu posição. Há **posições duplicadas** (50, 110, 130, 140, 200 aparecem em duas chaves), então qualquer restauração precisa reatribuir posição com cuidado para não deslocar etapas — risco real, mas contornável.

## 12. JANELA TEMPORÁRIA DE DOMINGO

A trava está em um **ponto único** (`resolveOperationalWindow`), consumido apenas pela tela da Ação do Dia: hoje é **somente visual** — o servidor não repete a checagem. Portanto:

1. Sim, é possível uma exceção com prazo fixo em 07/09/2026 23:59:59 (São Paulo). 2–4. Ela seria uma condição datada dentro dessa mesma função; passada a data, deixa de ser verdadeira sozinha, sem execução, sem cron e sem registro. 5–6. Fica isolada na execução manual: a janela de envio do motor vive em outro arquivo e não é tocada. 7–8. Expira sozinha; às 00:00 de 08/09 o domingo volta a ser fechado. 9–10. A regra permanente (seg–sex 06:00–22:00, sábado 06:00–17:00, domingo fechado) não muda nenhum valor, e nada persiste após a expiração. 11. O melhor ponto é exatamente `resolveOperationalWindow`, com a data-limite declarada e comentada como temporária.

Confirmo o enquadramento do item 15: regra permanente intacta, exceção só até 07/09 23:59:59, expiração automática às 00:00 de 08/09, nenhuma configuração nova de "domingo aberto".

## 13. PLANO DA PRÓXIMA CONSTRUÇÃO (não executado)

1. Você decide, uma a uma, o destino do texto ativo de E2, E5, E6 e E7 (mantendo TESTE como histórico).
2. Republicar cada texto escolhido como **nova versão da etapa oficial de destino**, preservando as linhas de origem como histórico.
3. Alinhar os títulos das 18 etapas divergentes à chave técnica, sem gerar versão de texto.
4. Normalizar as posições duplicadas.
5. Aplicar a exceção temporária de domingo no ponto único.
6. Validar: nenhuma etapa legítima na caixa de histórico; versões antigas presentes; cópia de mensagem chegando à área de transferência; Concluído, Pular, observação e Nota do Executivo funcionando; nenhum envio real; e, após a meia-noite, domingo bloqueado novamente.
