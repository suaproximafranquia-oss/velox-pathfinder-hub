# Diagnóstico arquitetural consolidado — Portal dos Leads, Cadência, Biblioteca e Jornada

Documento de validação. Nenhuma implementação, migration ou alteração de dados nesta etapa (confirmação **L**).

## A) Regras já suportadas pelo código atual

- **Fluxo de reengajamento RE0–RE3**: existe em `src/lib/relationship/config.ts` (`reentrada: ["RE0","RE1","RE2","RE3"]`) e é aberto por `machine.ts`. Só falta a regra de entrada correta.
- **Janela de 24h**: `relationship_cadences.window_open_until`, `last_inbound_at`, `last_outbound_at` já mantêm o estado; o disparo já é reativo a mensagem recebida.
- **Identidade por ID externo**: `crm_leads.external_id` + dedupe por telefone normalizado; nome nunca é chave.
- **Ciclos de entrada**: `last_entry_at` / `entry_count` já distinguem reentradas.
- **Links assinados**: `src/server/portal-token.server.ts` gera HMAC com expiração; hoje o TTL é global (30 dias).
- **Histórico append-only**: `crm_lead_events`, `relationship_events`, `relationship_decisions`, `crm_timeline` já são somente-inserção.
- **Registro de conteúdo enviado**: `content_history` e `opening_template_history` já existem na cadência.

## B) Regras que exigem apenas ajuste

1. **NOVOS x tags (§1)** — trocar a heurística atual por: coluna NOVOS + apenas tag NOVOS = novo (E0); coluna NOVOS + qualquer outra tag de etapa = reengajamento (RE0). REMARKETING fica fora da decisão (dimensão separada).
2. **Etapas elegíveis (§4)** — `ELIGIBLE_STAGE_KEYS` em `src/lib/crm/cadence.ts` passa a `zero_contato`, `frio`, `agendamento`.
3. **OPORTUNIDADE terminal (§4, §10)** — encerrar instância ativa, cancelar itens `relationship_queue` pendentes e bloquear novas etapas. Movimentação entre ZERO/FRIO/AGENDAMENTO não encerra nada.
4. **Histórico falso (§23)** — `src/server/crm/lead-service.server.ts:410` grava `lead_sincronizado` "sem alterações" a cada varredura. Passa a só atualizar `last_synced_at`; eventos antigos permanecem.
5. **CRM (§2, §22)** — remover "Reenviar boas-vindas" (`src/components/crm/portal-leads-board.tsx:183`) e o seletor de templates de cadência do composer; conversa humana na janela aberta permanece.
6. **Primeiro nome (§18)** — normalizar o primeiro nome no ponto de renderização, nunca no histórico já gravado.
7. **Dia útil da finalização (§8)** — prazo em dia útil → próximo dia útil; sábado/domingo → segunda. Sem empurrões extras. E27 é sempre +7 dias corridos, sem deslocamento.

## C) Regras que exigem nova estrutura

| Regra | Estrutura nova |
| --- | --- |
| §5, §6, §9 — múltiplas instâncias | `relationship_cadences` hoje é uma linha por lead. Nova coluna `instance_seq` + chave única (`scope`,`lead_id`,`instance_seq`) e `active` — aditivo; a linha atual vira a instância 1. |
| §6 — evento E20 | Tabela `relationship_e20_occurrences`: instância, lead, executivo gerador, `link_token`, `generated_at`, `expires_at` (+7 corridos), `e27_due_on`, `finalization_due_on`, status. |
| §6 — link com TTL próprio | `issueToken` passa a aceitar TTL por emissão (7 dias) + rota de resgate que valida a ocorrência. |
| §11, §12 — versionamento | `library_messages` (finalidade/grupo, corpo, ativa) + `library_message_versions` (versão imutável). Envio grava snapshot: id da versão, conteúdo e texto renderizado. |
| §13, §14, §15, §16 — jornada unificada | View/tabela `lead_journey_events` consolidando Portal, Workspace, Cadência e Remarketing, com `source_env`, `kind`, `preview`, `body`, `actor`. Notas manuais entram como `kind = 'nota_manual'`. |
| §17 — precedência manual | `crm_leads.manual_overrides jsonb` (campo → valor, autor, data) respeitado pelo `upsertLead`, reversível. |
| §19 — telefone do executivo | Coluna `whatsapp` em `executive_profiles`; hoje o número só existe em código (`src/lib/executive-auth.ts`). |
| §2, §21 — resposta automática com botão | Binding de template/conteúdo da resposta de janela + resolução dinâmica do número do executivo responsável. |

## D) Conflitos e riscos de regressão

- **Instância x código atual**: todo acesso a `relationship_cadences` hoje assume uma linha por lead. Migrar sem adaptar os leitores quebra o motor — a migração precisa ser aditiva e os leitores passam a filtrar `active = true`.
- **E20 x cadência ativa**: E20 pausa a instância corrente e abre outra; sem trava, dois relógios disparariam para o mesmo lead.
- **Ligações x mensagens**: `cadence.ts` (ligações) e `relationship/` (mensagens) são motores distintos; incluir AGENDAMENTO afeta a fila de ligações — precisa ser decidido por canal.
- **Biblioteca como fonte oficial**: hoje o motor usa textos fixos em `src/lib/relationship/messages.ts` em modo simulação. Trocar a fonte sem fallback deixa etapas sem texto (`FINALIZACAO`, `RE1`, `RE2` estão vazias).
- **Precedência manual x reconciliação**: sem `manual_overrides`, a próxima sincronização desfaz a correção do executivo.
- **Remoção do `lead_sincronizado`**: telas que contam eventos para "última atividade" podem ficar vazias — usar `last_synced_at`.

## E) Ordem ideal de implementação

1. **Fase 1 — Higiene e identidade**: fim do `lead_sincronizado` vazio, regra NOVOS x tags, remoção de "Reenviar boas-vindas" e do seletor de templates, `manual_overrides`, campo de WhatsApp do executivo.
2. **Fase 2 — Instâncias e E20**: `instance_seq`, encerramento por OPORTUNIDADE, tabela de ocorrências E20, link de 7 dias, E27 (+7 corridos) e finalização na Ação do Dia.
3. **Fase 3 — Biblioteca e versionamento**: mensagens versionadas, snapshot no envio, reorganização de grupos e vídeos.
4. **Fase 4 — Jornada unificada e Remarketing**: timeline consolidada com prévia/expansão, notas manuais, eventos de remarketing na jornada do executivo.

Motivo da ordem: cada fase é independente e reversível; nada da fase 1 depende de estrutura nova pesada, e a fase 3 só faz sentido depois que as instâncias existem para ancorar o snapshot.

## F) Decisões ainda faltantes

1. AGENDAMENTO entra também na fila de **ligações** ou apenas na cadência de mensagens?
2. Se o executivo gerar uma segunda E20 antes de vencer a primeira: substituir o link ou recusar?
3. Reengajamento (RE0) é automático como a E0 ou assistido (ação do dia)?
4. Lead sem executivo responsável: qual número usar no botão "Falar com o executivo"?
5. A resposta automática da janela tem limite de repetição por período (evitar spam a cada resposta)?
6. E30 continua desativada, ou entra como etapa oficial nesse novo modelo?

## G) Arquivos/componentes afetados

- `src/server/crm/lead-service.server.ts` — evento vazio, `manual_overrides`, precedência de sincronização.
- `src/server/crm/lead-intake.server.ts`, `src/lib/crm/board.ts` — regra NOVOS x tags.
- `src/lib/crm/cadence.ts`, `src/server/crm/cadence.server.ts` — etapas elegíveis, encerramento por OPORTUNIDADE.
- `src/lib/relationship/machine.ts`, `config.ts`, `entry.ts`, `types.ts`, `messages.ts` — instâncias, E20/E27, fonte de texto.
- `src/server/relationship/repository.server.ts`, `scheduler.server.ts`, `engine.server.ts` — leitura por instância ativa e cancelamento de fila.
- `src/server/portal-token.server.ts` + nova rota de resgate — link E20 de 7 dias.
- `src/components/crm/portal-leads-board.tsx`, `crm-conversation.tsx`, `crm-lead-ficha.tsx` — botões removidos, "GERAR E20", edição de nome/telefone, notas manuais, timeline.
- `src/routes/executivo.biblioteca.tsx` + serviço de biblioteca — versionamento e grupos.
- `src/server/remarketing/*` — publicação de eventos na jornada compartilhada.
- `src/routes/executivo.perfil.tsx` / `executive_profiles` — telefone do executivo.

## H–K) Confirmações explícitas

- **H)** Confirmado: **E20 cria uma NOVA instância de cadência**. A instância anterior é encerrada/pausada e permanece intacta; nada é sobrescrito, inclusive anos depois de uma E30.
- **I)** Confirmado: **OPORTUNIDADE é o limite absoluto**. Encerra a instância, cancela a fila pendente e nenhuma etapa nova é executada; o acompanhamento passa a ser manual.
- **J)** Confirmado: **coluna NOVOS com apenas a tag NOVOS = lead novo → E0**; **NOVOS + qualquer outra tag de etapa = reengajamento (RE0–RE3)**. REMARKETING não participa dessa decisão.
- **K)** Confirmado: **mensagens enviadas ficam congeladas**. Cada envio grava versão, conteúdo e texto renderizado; editar a E1 amanhã não altera nenhuma E1 já enviada.
- **L)** Confirmado: **nenhuma implementação nesta etapa**. Nenhum código, banco, migration, dado ou interface foi alterado.

## Resposta à pergunta principal (§25)

O modelo é consistente, mas ainda **não estava completo**: faltavam (i) a instância de cadência como entidade de primeira classe, (ii) a ocorrência E20 com relógio próprio, (iii) o versionamento imutável das mensagens e (iv) a jornada consolidada entre os três ambientes. Com os itens acima incorporados, a arquitetura fica fechada — exceto pelas seis decisões da seção F.
