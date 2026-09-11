# Diagnóstico read-only — E1 de João Figueiredo

## Registro encontrado

- Lead: **João Figueiredo**, `lead_id = gs_59279`.
- Ação atual: `flow = sem_resposta`, `step = E1`, `action_kind = message`, `action_order = 3`, `status = PROCESSING`.
- A fila encaminha `step = E1` para a leitura da Biblioteca.
- Para E1, `resolveStepContextForLead()` retorna **NULL**. `SEM_RESPOSTA` é o fluxo da cadência, não um `step_context` da Biblioteca.
- Existe exatamente um registro ativo para `scope = production`, `step_key = E1`, `step_context IS NULL`:
  - `id`: `ba637f5e-6546-49e0-87e6-01d9d07a9b95`
  - `code`: `LIB-E1`
  - `version`: `5`
  - `active`: `true`
  - `button_kind`: `content`
  - `content_url`: `NULL`
  - `content_label`: `NULL`
  - `body`: preenchido e contém `{{conteudo_e1}}`
  - `body_without_name`: preenchido e também contém `{{conteudo_e1}}`

## Regra que bloqueou

`prepareStepMessage()` resolve E1 sem contexto, chama `renderFromLibrary()`, que encontra a versão ativa V5. `renderMessageSpec()` detecta `{{conteudo_e1}}` no texto escolhido e exige uma URL. Como `content_url` está vazio, retorna exatamente:

> Etapa E1 exige link de conteúdo e a versão ativa da Biblioteca está sem link configurado.

Não há fallback de link em produção.

## Causa provável

**A — cadastro incompleto da versão ativa na Biblioteca.**

A resolução de etapa/contexto está correta: E1 usa o slot normal (`step_context = NULL`), enquanto `sem_resposta` identifica o fluxo da fila. A regra de link também está coerente com a mensagem publicada, pois ambas as redações contêm o marcador de conteúdo e o registro declara `button_kind = content`.

## Por que o erro aparece no modal

Esse é o comportamento compartilhado implementado recentemente. O carregamento devolve o registro e seu `blockedReason`; o modal abre mesmo sem corpo renderizado e mostra o motivo dentro do painel. A abertura não depende do sucesso do clipboard.

## Próximo passo recomendado

Na Biblioteca, publicar a próxima versão de **E1 no contexto normal** com o link e, opcionalmente, o rótulo do conteúdo preenchidos. Se E1 não deveria oferecer conteúdo, a alternativa é publicar uma versão cujo texto não contenha `{{conteudo_e1}}` e cujo botão não seja de conteúdo. Nenhuma alteração foi executada neste diagnóstico.
