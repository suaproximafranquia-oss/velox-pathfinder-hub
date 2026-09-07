# Correção — etapa repetida na lista do motor (Financeira /f)

## O que a investigação mostrou

A gravação está **correta**. Ao salvar uma edição, o sistema desativa a versão anterior e cria a versão seguinte, encadeada à anterior. Conferido no banco: E1 tem 5 versões encadeadas e **apenas uma ativa**; E0 tem 6 versões e apenas uma ativa. Nenhum registro solto, nenhuma etapa criada em duplicidade.

Ou seja: **não há INSERT indevido**. O que está errado é uma **lista de exibição** que mostra uma linha por versão em vez de uma linha por etapa.

- A tela Biblioteca de Mensagens já agrupa por etapa e mostra só a vigente — está correta.
- A lista de etapas usada na montagem dos fluxos do motor devolve **todas as versões**, sem agrupar. Por isso "E1 — Primeiro acompanhamento" aparece repetido, com títulos de versões diferentes ("E2 — Segundo acompanhamento" era o título de uma versão antiga da mesma etapa E1).

## O que será feito

1. Fazer essa lista devolver **uma entrada por etapa**, usando a versão vigente (a ativa; se não houver ativa, a mais recente). Critério de identidade: a chave da etapa já existente no projeto (`step_key`) — nenhuma regra nova é inventada.
2. Nada é apagado. Todas as versões continuam gravadas e visíveis no histórico da Biblioteca.
3. Nenhuma alteração de texto, de chave, de numeração de etapa ou de rótulo.

## Detalhe técnico

- Ajuste em `src/lib/relationship/flows.functions.ts`, na função `etapasDisponiveis`: reduzir o resultado de `listLibraryMessages()` por `stepKey`, preferindo `active`, com fallback para a maior `version`.
- `src/server/relationship/message-library.server.ts` (`publishLibraryVersion`, `listLibraryMessages`) **não muda**: o versionamento e o histórico completo permanecem como estão.
- Sem migração, sem SQL, sem `DELETE`, sem `UPDATE`.
- Este ponto é usado apenas pelo painel de fluxos do Workspace `/f`; `/s`, `/seg` e `/` não são tocados.

## Validação

Typecheck e build, e conferência de que cada etapa aparece uma única vez na lista de fluxos, com o rótulo da versão vigente, e que o histórico de versões continua íntegro na Biblioteca.
