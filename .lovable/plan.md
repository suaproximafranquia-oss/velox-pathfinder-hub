# Diagnóstico — Jornada do Investidor x Auditoria Técnica

Somente diagnóstico. Nada foi alterado: sem código, sem migration, sem banco, sem publicação.

## A) Causa provável

O agregador da Jornada é um **espelho bruto de todas as trilhas**, sem camada de classificação. `loadLeadJourney` lê oito tabelas (`crm_timeline`, `crm_messages`, `relationship_message_sends`, ocorrências/acessos E20, `crm_cadence_tasks`, `portal_meetings`, `portal_journey_events`) mais Remarketing e devolve **tudo** que encontra, apenas ordenado por data. Qualquer linha gravada por rotina técnica vira automaticamente "jornada".

Três causas específicas somam-se a isso:

1. **`crm_timeline` é uma tabela mista.** Ela guarda ao mesmo tempo fatos relacionais (nota, mudança de coluna, oportunidade, atividade no Portal) e ruído técnico (`relacionamento_oficial`, `duplicidade_detectada`, `conversa_aberta`, `sincronizacao*`, `distribuicao_realizada`). O dicionário `TIMELINE_TITLES` inclusive **traduz** esses eventos técnicos para títulos bonitos, o que os faz parecer conteúdo legítimo.
2. **Eventos técnicos são gravados no navegador, com ID aleatório.** `recordCrmEvent` (`src/lib/crm/timeline.ts`) grava em localStorage com `id` randômico e só evita duplicar contra a *última* entrada dentro de 60s, por navegador. O `pushCrmRecords` sobe com `upsert onConflict: id` — como o id muda a cada sessão, **não há idempotência real**.
3. **O modo simulado grava no mesmo lugar que o real.** A E0 simulada escreve em `crm_messages` com o rótulo `[TESTE — E0 SIMULADA]` embutido no corpo e no `author_name`, e uma linha `primeiro_contato` em `crm_timeline`. A Jornada não distingue simulação de envio real quando o registro vem por `crm_messages` (o campo `simulated` só existe nos snapshots do motor e no Remarketing).

### Respostas às perguntas

| # | Pergunta | Achado |
|---|---|---|
| 1 | Fonte de cada evento | "Entrada do lead" → `portal_leads`. "[TESTE — E0 SIMULADA]" → `crm_messages` (gravado por `first-contact.server.ts` / `dispatch.server.ts`). "Primeiro contato" → `crm_timeline`, evento `primeiro_contato`. "Relacionamento oficial definido" → `crm_timeline`, evento `relacionamento_oficial`. |
| 2 | Por que duplica | Não duplica só duas vezes — há leads com 2, 3, 14, 15 e até 16 linhas de `relacionamento_oficial`. Emissores diferentes (`listConversations`/`ensureOwnership` no CRM, `distribution.ts`, redistribuição) gravam o mesmo fato, cada um com id novo; o upsert por id não deduplica. |
| 3 | Por que a E0 simulada aparece | O teste é registrado como mensagem real, com o rótulo dentro do texto. Não existe coluna `simulated` em `crm_messages`, então a Jornada não tem como filtrar. |
| 4 | Por que "Primeiro contato" vem separado | A E0 grava **dois** registros: a mensagem (`crm_messages`) e o marco (`crm_timeline`). O agregador só deduplica mensagem ↔ snapshot (`snapshotByMessageId`), nunca mensagem ↔ marco de timeline. |
| 5 | Falta camada de classificação | Sim. Não há whitelist, nem campo de "visibilidade", nem separação entre trilha operacional e trilha técnica. |
| 6 | O que entra hoje | Tudo: sincronizações, distribuição, duplicidade detectada, conversa aberta, definição de dono, testes simulados. |
| 7 | Risco de perder auditoria | Baixo, **se** o filtro for só de apresentação. Todas as linhas continuam nas tabelas de origem; nada precisa ser apagado. |

## B) Arquivos e componentes envolvidos

- `src/server/relationship/journey.server.ts` — agregador (sem filtro).
- `src/components/crm/crm-lead-journey.tsx` — exibição na ficha.
- `src/lib/relationship/library.functions.ts` — server fn `jornadaDoLead`.
- `src/lib/crm/timeline.ts` — `recordCrmEvent`, id randômico, dedupe fraca.
- `src/lib/crm/relationships.ts` (`ensureOwnership`), `src/lib/crm/distribution.ts` — emissores de `relacionamento_oficial`.
- `src/server/crm/first-contact.server.ts`, `src/server/relationship/dispatch.server.ts` — E0/etapas, inclusive simuladas.
- `src/lib/crm/e0-simulation.ts` — chave do modo simulado.

## C) Devem continuar na Jornada

Entrada do lead; mensagens enviadas com snapshot (E0/E1/E20/E27/finalização executadas); mensagens recebidas; E20 gerada, acessada e encerrada; ligações concluídas; reuniões agendadas/canceladas; atividade no Portal/material; mudança de coluna relevante; oportunidade; notas do executivo; remarketing enviado e respondido.

## D) Devem sair da Jornada (viram auditoria)

`relacionamento_oficial`, `duplicidade_detectada`, `conversa_aberta`, `distribuicao_realizada`, `sincronizacao*` (incluindo tardia/iniciada), decisões internas do motor e reconciliações; qualquer registro `simulated = true` fora do ambiente de homologação; e o marco `primeiro_contato` quando já existe a mensagem correspondente na mesma janela (o fato relacional é a mensagem, não o marco).

## E) Risco da alteração

Baixo, desde que a mudança seja **apenas de leitura**. Riscos a controlar:
- Filtrar por título/texto é frágil — o filtro deve ser por `event`/`kind`, em lista explícita.
- Alguns eventos hoje ruidosos são o único vestígio de troca de responsável; a aba de auditoria precisa existir antes de escondê-los.
- Nada deve ser apagado de `crm_timeline`: a blindagem de dados e a Central de Backup dependem dessas linhas.

## F) Menor implementação necessária

Uma única camada de classificação no agregador, sem tocar em banco nem em emissores:

1. Em `journey.server.ts`, criar um mapa `EVENT_VISIBILITY: 'relacional' | 'tecnico'` e marcar cada entrada com essa classificação (whitelist relacional; o resto é técnico por padrão).
2. `loadLeadJourney(leadId, { layer })` passa a aceitar a camada: `relacional` (padrão, usado pela ficha) e `tecnica` (auditoria completa, comportamento atual).
3. Deduplicar `primeiro_contato` contra a mensagem de E0 da mesma janela, do mesmo jeito que já se faz com snapshot ↔ mensagem.
4. Detectar simulação em `crm_messages` pelo rótulo já gravado e marcar `simulated: true`; ocultar simulados da camada relacional em produção.
5. Em `crm-lead-journey.tsx`, um alternador discreto "Jornada / Auditoria técnica" — a auditoria continua acessível, só deixa de ser o padrão.

Correções opcionais, em etapa posterior e separada: tornar `recordCrmEvent` idempotente (id determinístico por fato) para estancar a multiplicação de `relacionamento_oficial` na origem.
