# Financeira /f — Diagnóstico operacional (somente leitura)

Nada foi alterado: nenhum código, banco, migration, Biblioteca, Ação do Dia, GreenSales ou Portal.

## A. E7 / E8 — estado atual

- O eixo de contexto **já existe tecnicamente**: a coluna `step_context` da Biblioteca aceita `SEM_CONTATO` ou `MATERIAL_ENVIADO`, e a leitura da mensagem já escolhe o contexto (`step-message.server.ts:25,83-100` + `message-library.server.ts:476`).
- O contexto é decidido pelo **histórico estruturado** (`loadMaterialState` só considera o evento `CONTENT_SENT`), nunca por título ou conversa. Isso está correto conforme a regra.
- **Conteúdo cadastrado hoje**: `E7` tem 2 versões (v1 inativa, v2 ativa), ambas com `step_context = NULL`; `E8` **não tem nenhum registro**. Nenhuma das 79 linhas da Biblioteca tem contexto preenchido.
- As duas variantes COM_NOME / SEM_NOME já existem como colunas (`body` / `body_without_name`) e as versões atuais de E7 preenchem as duas.
- **Lacuna 1 (editorial)**: faltam os 4 quadrados de E7 com contexto e os 4 de E8 — hoje são 1 texto sem contexto para E7 e zero para E8.
- **Lacuna 2 (configuração)**: a lista oficial da Biblioteca (`OFFICIAL_STEP_KEYS`) ainda deriva do arquivo antigo `config.ts`, que só declara E0, E1, E3, E4, E12, E30, V3, V4, R1–R3, RE0–RE3, RF0–RF1. Por isso E2, E5, E6, E7 aparecem como "alias histórico" e E8 nem existe para a interface, mesmo com a nova régua já executando E0–E8.
- O motor **já sabe** decidir o contexto (a régua V2 distingue o ramo E4→E7 do ramo E4→E5→E6→E7). Portanto o problema é **editorial + lista oficial de etapas**, não lógica de decisão.

## B. Follow-up do GreenSales — estado atual

- O `follow_up` **não é lido por nada**: não existe uma única referência a esse campo no código. O normalizador do GreenSales extrai apenas nome, e-mail, WhatsApp, cidade, campanha e material.
- Ele **existe no banco** apenas como conteúdo bruto: 443 dos 657 leads têm `follow_up` dentro de `raw_payload` em `crm_leads`, guardado como auditoria.
- Não existe vínculo entre `crm_leads` e `portal_meetings`: a tabela de compromissos não tem coluna de lead do CRM nem identidade externa (origem + ID GreenSales).
- Consequências diretas: só se enxerga o último valor; não há histórico das trocas de horário; remover o follow_up no GreenSales não cancela nada; não há regra ligando follow_up a AGENDAMENTOS; não há obrigação na Ação do Dia nem T-5 vindo desse campo.
- O T-5 existe, mas só para reuniões já criadas em `portal_meetings` (hoje há 1 registro, cancelado).

## C. Pós-agendamento — estado atual

Já existe:
- Compromisso persistido em `portal_meetings`, com status e reagendamento.
- Entrada em foco 5 minutos antes e prioridade máxima na Ação do Dia.
- Pergunta de resultado e reagendamento (`resolveMeetingOutcome`, `rescheduleMeeting`), com registro em histórico.
- Congelamento da cadência enquanto o lead está em AGENDAMENTOS.

Ainda não existe:
- Estado "vencido sem contato e sem reagendamento".
- Obrigação persistente de 24 horas com a pergunta de encerramento.
- Orientação para reagendar no GreenSales em vez de criar horário no Portal.
- Detecção estruturada da movimentação humana AGENDAMENTOS → FRIOS: a regra `canStartReengagement` existe e está testada, mas nunca é chamada em produção — nada grava o estágio anterior nem marca que a mudança foi humana. Hoje o fluxo R não é liberado por essa transição.

## D. Classificação de atraso — causa exata

- Quem classifica: `isOverdueByBusinessDays` (`daily-actions-overdue.ts:53`), aplicada ao primeiro contato em `daily-actions.server.ts:171-172`.
- Data usada: `created_at` da ação de E0 (`workspace_e0_actions`), ou seja, praticamente a entrada do lead — não um vencimento de cadência.
- Cadeia: `availabilityDate(created_at)` decide o "dia disponível". O corte usado é **18:00**, não 17:30. Um lead que entra sexta 17:31 recebe **sexta** como dia disponível.
- Na segunda-feira, o dia útil corrente passa a ser segunda e a comparação "sexta < segunda" marca o lead como atrasado **já na primeira hora da segunda**, sem lhe dar a segunda como dia de trabalho. Essa é a causa exata do sintoma relatado.
- Sábado e domingo **não** geram vencimento por si sós, e não há criação de obrigação antes da abertura operacional. Também não existe classe própria "NOVO": o primeiro contato só tem dois estados possíveis, "hoje" ou "atrasada" — não há distinção entre "lead novo aguardando primeiro contato" e "ação que estava disponível e não foi feita".

Respostas diretas:
- Entrou sexta 17:31 → hoje aparece **atrasado** na segunda (deveria aparecer como novo).
- Entrou sábado ou domingo → aparece **novo** na segunda (correto hoje).
- Entrou segunda 09:01 e não foi atendido → **atrasado** na terça (coerente com a regra).

## E. Regra de autoridade — confirmada

O modo do E0 vem exclusivamente da configuração do executivo (`workspace_module_permissions`, chave `e0_automatico`, lida por `resolveExecutiveE0Mode`). Ausência de configuração significa manual. Não há exceção por lead em nenhum ponto lido.

## F. O que precisa ser construído depois (nada disso foi feito)

1. Corrigir a classificação de atraso do primeiro contato: alinhar o corte ao expediente real (17:30), tratar "lead novo com primeiro contato pendente" como classe própria e garantir pelo menos um dia útil inteiro de janela antes de virar atraso; ordenar segunda-feira como Agendamentos → Novos (ordem de entrada) → Cadência atrasada → Cadência do dia.
2. Abrir os quadrados contextuais E7 e E8 na Biblioteca (4 combinações cada, COM_NOME e SEM_NOME), incluindo E7/E8 na lista oficial de etapas. Os textos serão cadastrados pela gestão — nada será inventado.
3. Espelhar o follow_up do GreenSales como compromisso: identidade externa (origem + ID do lead), atualização do mesmo compromisso a cada troca de horário, histórico das alterações, cancelamento quando removido na origem e criação apenas quando o lead está em AGENDAMENTOS.
4. Fechar o pós-agendamento: estado "vencido sem contato e sem reagendamento", pendência de 24 horas com a pergunta de encerramento, orientação para reagendar na origem e detecção estruturada da movimentação AGENDAMENTOS → FRIOS que libera o fluxo R.

## Arquivos e funções envolvidos

- Atraso: `src/lib/crm/daily-actions-overdue.ts`, `src/server/crm/daily-actions.server.ts`, `src/lib/crm/daily-actions.ts`, `src/server/crm/e0-actions.server.ts`.
- E7/E8: `src/server/relationship/message-library.server.ts`, `src/server/relationship/step-message.server.ts`, `src/lib/relationship/step-registry.ts`, `src/lib/relationship/config.ts`, `src/server/relationship/cadence-v2-state.server.ts`.
- Follow-up e agendamento: `src/lib/greensales/normalize.ts`, `src/server/crm/lead-service.server.ts`, `src/server/crm/daily-actions-log.server.ts`, `src/lib/meetings.functions.ts`, `src/lib/relationship/cadence-v2.ts` (`isCadenceFrozen`, `canStartReengagement`).
- Autoridade do E0: `src/server/crm/first-contact-mode.server.ts`.
