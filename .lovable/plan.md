# Diagnóstico — Michel: ação de cadência x compromisso GreenSales (/f)

Somente leitura. Nenhum código, migration ou dado foi alterado.

## A) Onde está o compromisso do Michel

Ele existe e está íntegro no espelho oficial (`portal_meetings`):

- registro `gsfu_59115`, investidor `gs_59115` (Michel), executivo Thiago Rodrigues;
- estado do follow_up: PENDENTE, situação "Agendada";
- horário atual: **11/09 às 18:00 (horário de Brasília)**.

O histórico do próprio registro mostra o que aconteceu:

```text
08/09 20:17  espelhado    follow_up "2026-09-09 11:00:00"  -> 09/09 11:00
09/09 10:56  reagendado   follow_up "2026-09-11 18:00:00"  -> 11/09 18:00
```

Ou seja: o compromisso de **hoje às 11:00 deixou de existir** — ele foi
reagendado na origem (GreenSales) hoje de manhã para 11/09 às 18:00, e o
sistema espelhou essa mudança corretamente, no mesmo registro, sem
duplicar.

## B) O compromisso continua correto?

Sim. `crm_leads` (external_id 59115) traz `follow_up = 2026-09-11 18:00:00`,
etapa `agendamentos`, e o espelho está exatamente nesse horário. Não há
erro de fuso nem duplicidade.

## C) Onde o compromisso vira item da Ação do Dia

`src/server/crm/daily-actions.server.ts` — leitura de `portal_meetings`,
com ramo próprio para `external_source = "greensales"`. Esse ramo produz
sempre `kind: "reuniao"`, `source: "meeting"`, título "Agendamento
(GreenSales)" e horário. Ele **nunca** empresta rótulo de cadência.

O rótulo do card é decidido em `src/components/crm/daily-action-card.tsx`:
"Ligação/Mensagem — Etapa X" só é escrito quando `source === "queue"`.

## D) Por que aparece "Ligação — Etapa E0"

Porque, hoje, **esse card não é o compromisso**. São duas entidades
distintas e apenas uma está na lista:

1. compromisso: 11/09 18:00 — fora da janela de leitura do dia (a Ação do
   Dia lê compromissos até ~2 dias à frente a partir do instante atual;
   11/09 18:00 fica um pouco além) e, mesmo dentro, seria "futura";
2. ação de cadência: existe uma ligação E0 pendente de Michel na fila
   (criada em 08/09, em atendimento), que continua liberada.

Portanto não há mistura nem conversão de entidade: o card mostrado é
legitimamente a ligação E0. O que está errado é **a E0 ainda estar
liberada** para um lead que já tem compromisso real em AGENDAMENTOS.

A regra de congelamento (`isCadenceFrozen`, em
`src/lib/relationship/cadence-v2.ts`, usada por `cadence-v2-decide.ts`)
impede **criar** obrigação nova enquanto há compromisso, mas não retira da
lista uma obrigação que já estava pendente antes do compromisso surgir.
A leitura em `daily-actions.server.ts` não aplica nenhum filtro
equivalente ao montar os itens de fila.

## E) Por que o aviso mostra Marco Antonio

O aviso (`listNextCommitments`, em `src/lib/agenda.functions.ts`) lê os
compromissos do executivo e escolhe o mais próximo no futuro. Com os dados
atuais: Marco Antonio hoje 16:00, depois Michel 11/09 18:00. O aviso está
**correto** — ele não pulou Michel por causa da E0; Michel simplesmente
não tem mais compromisso hoje.

## F) Menor correção necessária

Uma só, e é de regra, não de rótulo:

**Compromisso real em AGENDAMENTOS/VÍDEO deve suspender a exibição das
ações de cadência já pendentes daquele lead**, e não apenas impedir a
criação de novas. Na leitura do dia, ao montar os itens vindos da fila,
o lead com compromisso vigente (follow_up PENDENTE em AGENDAMENTOS ou
VÍDEO) deixa de oferecer ligação/mensagem, exatamente como já acontece na
porta de decisão. Nada é apagado: a obrigação continua na fila e volta se
o compromisso for cancelado ou o lead sair do estágio.

Nada precisa mudar em rótulos, no aviso de próximo compromisso, na regra
de T-5/futuro, na velocidade ou no GreenSales.

## G) Arquivos e funções que a correção tocaria

- `src/server/crm/daily-actions.server.ts` — `buildDailyActions`, laço da
  fila `relationship_queue`: aplicar a suspensão por compromisso vigente
  usando os compromissos já carregados nessa mesma leitura.
- Reuso, sem alteração: `isCadenceFrozen` / `isCommitmentStage`
  (`src/lib/relationship/cadence-v2.ts`) e `FOLLOW_UP_STATES`.
- Teste dirigido em `src/lib/crm/daily-actions.test.ts` (ou equivalente do
  servidor) cobrindo: lead com compromisso vigente não exibe E0; lead sem
  compromisso continua exibindo; compromisso cancelado devolve a ação.

Sem migration, sem tabela nova, sem fila nova, sem alterar `/s`, `/s/portal`
ou `/seg`.

## Observação de checagem

O compromisso "hoje 11:00" que você viu no GreenSales pode estar em outro
lead ou ser a tela antiga em cache: no dado sincronizado, o de Michel foi
movido hoje às 10:56 para 11/09 18:00. Se no GreenSales ele ainda constar
hoje às 11:00, o próximo passo é olhar a sincronização daquele lead — não
a Ação do Dia.
