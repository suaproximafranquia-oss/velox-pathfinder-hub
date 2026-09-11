# Diagnóstico read-only — divergência do Relógio acelerado

## Constatações confirmadas

- O cartão chama `environmentClockStatusFn`; a tentativa de ligar chama `activateEnvironmentClockFn`, que chega a `assertOnlyValidationLeads()`.
- A trava consulta `crm_leads` com `select("id").limit(200)`. Portanto, a mensagem **“200 cadastros” não é uma contagem exata**: é o teto da consulta.
- A consulta exata atual encontrou **413 registros em `crm_leads`**, sendo os quatro IDs preservados presentes e 409 registros adicionais.
- Os 200 registros lidos pela trava são uma página não ordenada de `crm_leads`. Na leitura reproduzida, os 200 eram `external_source = greensales`, `is_test = false`, criados novamente após 01:00 UTC, e nenhum dos quatro IDs de validação estava nessa página.
- A estrutura visual/operacional `portal_leads` contém atualmente **6 cards**: os quatro preservados mais `gs_59303` (Adriana) e `gs_59307` (Quero poder emprestar o meu próprio dinheiro).
- Assim, hoje há duas medidas diferentes:
  - espelho interno da integração: `crm_leads` = 413;
  - cards do Workspace: `portal_leads` = 6.

## Causa da divergência

A limpeza anterior deixou quatro linhas nas duas estruturas naquele instante. Depois, a sincronização automática voltou a ler a origem externa. Como os demais registros haviam sido removidos do espelho interno, o sincronizador os classificou como ausentes e os recriou de forma idempotente em `crm_leads`.

A cronologia do banco confirma a recriação:

- 153 registros criados às 01:04 UTC;
- 94 registros criados às 01:05 UTC;
- 162 registros criados às 01:20 UTC;
- total recriado após 01:00 UTC: 409;
- somados aos quatro preservados: 413.

Os registros recriados são **leads reais sincronizados do GreenSales**, não fictícios (`is_test = false`) e não meros arquivos do cartão. A maioria entrou somente como espelho histórico em `crm_leads`; por isso não virou card em `portal_leads`. Dois novos registros recentes percorreram o caminho operacional e criaram os dois cards adicionais.

## Respostas objetivas

1. **Fonte dos “200”:** `crm_leads`, lida sem filtro e limitada a 200 em `src/server/time/environment-clock.server.ts:147-156`.
2. **Quais registros:** uma página arbitrária de 200 linhas do espelho interno `crm_leads`; na reprodução, todos eram leads reais GreenSales recriados após 01:00 UTC. O número 200 não representa o total atual.
3. **Workspace considerado no reset:** a limpeza tratou separadamente `portal_leads` e `crm_leads`. Atualmente são 6 e 413, respectivamente; imediatamente após o reset, eram 4 e 4.
4. **Natureza dos 200:** cópias internas reais e sincronizadas da origem externa; não são testes. Elas incluem registros históricos e operacionais de várias etapas.
5. **Por que antes 4 e agora 200:** a limpeza realmente deixou quatro, mas a trava consulta o espelho interno sem filtro, e a sincronização posterior repovoou esse espelho. O `.limit(200)` mascara o total real de 413.
6. **Nova sincronização:** sim. As datas de criação/sincronização e os ciclos automáticos registrados confirmam a recriação após a limpeza.

## Arquivos responsáveis

- `src/components/executive/environment-clock-card.tsx` — cartão e acionamento.
- `src/lib/testing/environment-clock.functions.ts` — funções administrativas chamadas pelo cartão.
- `src/server/time/environment-clock.server.ts:147-156` — consulta sem filtro com limite 200 e texto exibido.
- `src/server/crm/sync-scheduler.server.ts:20-47` — execução automática da sincronização.
- `src/server/crm/lead-sync.server.ts:249-340, 377-451` — identifica ausentes e recria espelho histórico ou entrada operacional.
- `src/server/crm/lead-service.server.ts:210+` — gravação idempotente em `crm_leads`.
- `src/server/crm/lead-intake.server.ts:121-150, 252+` — cria/atualiza card em `portal_leads` quando a entrada percorre o caminho operacional.

## Escopo preservado

Nenhum código, dado, relógio, sincronização, reset ou deploy será alterado neste diagnóstico.
