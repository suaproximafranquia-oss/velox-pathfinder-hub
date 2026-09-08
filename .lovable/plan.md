# Diagnóstico e correção — compromisso da Kaline não virou reunião nem nota

## O que foi encontrado (verificado nos dados reais)

- Lead localizada: **Kaline**, e-mail `mks.soares@hotmail.com`, telefone final **12-65**, código externo **59066**.
- A etapa **AGENDAMENTOS** e o horário do compromisso **09/09/2026 às 18:05** chegaram corretamente ao sistema (registro atualizado hoje às 19:54, horário de São Paulo). Nada foi perdido nem transformado.
- Nenhuma reunião foi criada para essa lead, e nenhuma nota automática foi gravada.
- A rotina de espelhamento roda a cada ~6 minutos junto com a sincronização e **falhou ao gravar**. A última execução registrou exatamente este erro: `there is no unique or exclusion constraint matching the ON CONFLICT specification`. O mesmo erro aparece em todas as execuções recentes, ou seja, **nenhum compromisso novo está sendo criado hoje** — não é um problema só da Kaline.

## Causa exata

Ao gravar o compromisso, o código usa uma regra de "não duplicar" apontando para o par origem + referência externa. O índice que garante essa unicidade no banco existe, mas é **parcial** (só vale quando a referência externa não é nula), e o banco não aceita esse tipo de índice nessa forma de gravação. Resultado: a gravação lança erro **antes** de criar a reunião, antes de registrar a Timeline e antes de chamar a nota automática.

- Arquivo/linha: `src/server/crm/greensales-followup.server.ts:317` (gravação do compromisso novo).
- A chamada da nota (`appendFollowUpNote`, mesma função `addInvestorNote` das Notas do Executivo) está logo abaixo, nas linhas 325–331, e nunca é alcançada.
- Índice atual: `portal_meetings_external_ref_uidx` em (origem, referência externa) **com filtro** `WHERE external_ref IS NOT NULL` (migração `20260908112009`).

Resposta direta aos pontos levantados: o fluxo correto é a sincronização GreenSales (`syncGreenSalesFollowUps` → `syncOneFollowUp`), ela **foi executada**, o `follow_up` **foi reconhecido e persistido**, mas a criação em `portal_meetings` **falhou**; por isso a nota não foi chamada. Nenhuma tag participou da decisão. O HAR do teste não chegou anexado ao ambiente, então o diagnóstico foi feito diretamente sobre código e dados reais — o que já identifica a causa com precisão.

## Correção proposta (mínima, sem tocar em cadência, Ação do Dia, /s ou /seg)

1. **Gravação do compromisso** (`src/server/crm/greensales-followup.server.ts`, criação): trocar a gravação por uma que use a **identidade determinística já existente do registro** (`id = gsfu_<código>`), que é chave primária real e aceita a regra de não duplicar. O comportamento continua idêntico: mesma identidade, mesma idempotência, segunda execução simultânea vira no-op. O índice parcial permanece como proteção adicional; nada é removido.
2. **Reprocessamento natural**: com a gravação corrigida, a própria sincronização periódica cria o compromisso da Kaline e das demais leads em AGENDAMENTOS/VÍDEO com horário válido, gerando Timeline e a nota "Agendamento criado — 09/09/2026 às 18:05" assinada por "Sincronização GreenSales". Sem backfill manual, sem script paralelo.
3. **Verificação**: testes direcionados da sincronização de follow-up e conferência, após uma rodada, de que existe reunião para a Kaline, uma nota automática única e nenhum erro novo na última execução.

## Fora do escopo

Sem nova tabela, fila, motor ou mecanismo paralelo. Sem alteração de cadência, Ação do Dia, Biblioteca, `/s` ou `/seg`. Nenhum histórico é apagado.
