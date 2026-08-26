# Análise Técnica — Portal dos Leads, GreenSales, Cadência, E20/E27 e Reengajamento

Nada foi implementado. Nenhuma migration, nenhuma alteração de código ou banco.

## A. Respostas às 20 perguntas (estado atual verificado)

**1. Identificação do lead.** Chave de integração `external_source='greensales'` + `external_id` (o ID do GreenSales). O nome nunca é chave. Existe uma segunda trava de deduplicação por telefone normalizado. Portanto o cenário "ID 12 = Wagner, nome corrigido na origem" já funciona: o lead é reconhecido e o nome é atualizado.

**2. Coluna.** `crm_leads.stage_key` (+ `external_stage_id`, `stage_entered_at`, `entered_entry_stage_at`). No Portal (`portal_leads`) o espelho tem campos próprios.

**3. Tags.** `crm_leads.tags` (jsonb, etiquetas íntegras da origem) e `raw_payload`. As colunas do funil vivem em `crm_pipeline_stages` (`external_tag` = a etiqueta que representa a coluna).

**4. ID do GreenSales.** `crm_leads.external_id`; no Workspace o card nasce com `id = gs_<external_id>`.

**5. Escolha de cadência.** `resolveBoardColumn` (`src/lib/crm/board.ts`) resolve a coluna e `resolveEntryFlow` (`src/lib/relationship/entry.ts`) decide entrada x reentrada. Hoje a decisão usa **relacionamento anterior + nova entrada comercial** (`entry_count`, `last_entry_at`), **não** a presença de outras tags operacionais. Já existe a marca `remarketing` quando a etiqueta REMARKETING coexiste com NOVOS.

**6. Registro de ações.** `crm_lead_events` (tipos enumerados em `lead-service.server.ts`), `relationship_events`, `relationship_decisions`, `crm_timeline` e `crm_messages`.

**7. Origem do "Lead reconhecido — sem alterações".** Encontrado: `src/server/crm/lead-service.server.ts`, último `else if (!changed)` do `upsertLead` grava `lead_sincronizado` **toda vez que o lead é revisto sem mudança**. Como o cron roda a cada 1 minuto e o agendador executa a cada 5 minutos varrendo **a base inteira**, cada lead gera ~288 eventos inúteis por dia. É ruído puro — a correção é não gravar evento quando nada mudou (no máximo atualizar `last_synced_at`).

**8. E0.** `src/server/crm/lead-intake.server.ts`: só quando o lead **entra agora** na coluna de entrada (`enteredEntryStage`, transição real), passa pela elegibilidade de cutover, pela janela operacional (fora dela vai para a fila de adiadas) e então `registerFirstContact`. Hoje está em modo simulado (`E0_SIMULATION_ENABLED`).

**9. Janela de 24h.** `relationship_cadences.window_open_until`, aberta em `machine.ts` por eventos de mensagem recebida e consultada antes de qualquer envio livre. A infraestrutura existe e está correta.

**10. Cadência manual.** Não existe "manual" ainda: as etapas E1+ são disparadas pelo motor. A fila humana existente é só de **ligações** (`crm_cadence_tasks`), com desfecho SIM/NÃO.

**11–13. E20 / validade de 7 dias.** **Não existe.** Existe token HMAC do investidor (`portal-token.server.ts`) com TTL de 30 dias e sem rota curta, e existe rastreio de acesso (`portal_engagement`, `portal_journey_events`). É base suficiente, mas a ocorrência E20 (geração, link, expiração, ciclo) precisa ser criada.

**14–15. Finalização / encerrar cadência.** Existe encerramento por etapa terminal (E12/E30) e estados `COMPLETED`/`CLOSED`/`INTERRUPTED` — mas **não** existe encerramento por OPORTUNIDADE nem finalização derivada de E20+7.

**16–17. Reengajamento / recadastro.** Existem os fluxos `reentrada` (RE0–RE3) e `relacionamento_frio` (RF0/RF1). A trava contra E0 repetida hoje depende de `hasPreviousRelationship` (houve mensagem antes) — **não** da presença de outras tags operacionais. É exatamente aqui que sua regra nova entra.

**18. Alterações manuais.** O botão Editar existe na ficha, mas **não há campo de proteção**: a próxima sincronização sobrescreve nome/telefone com o valor da origem. Falta uma marca de "campo travado manualmente".

**19. Impacto.** `lead-service.server.ts`, `lead-intake.server.ts`, `board.ts`, `entry.ts`, `config.ts`/`machine.ts`/`decide.ts`, `portal-leads-board.tsx`, `crm-lead-ficha.tsx`, `portal-token.server.ts`, + novas tabelas para ocorrências E20 e ações do dia.

**20. Conflitos reais que já identifico.**
- `resolveBoardColumn` hoje escolhe a **coluna mais avançada**. Um lead com NOVOS + OPORTUNIDADES é classificado como OPORTUNIDADES, não como NOVOS. Sua regra nova diz o oposto para o recadastro (está em NOVOS, mas com histórico → reengajamento). Precisa de decisão explícita: **o que a origem entende por "está na coluna NOVOS"** quando ele carrega duas etiquetas.
- Remover o botão "Reenviar boas-vindas" é seguro (só interface, `portal-leads-board.tsx:183`).
- Encerrar cadência em OPORTUNIDADE conflita com a fila de ligações, que só olha `zero_contato`/`frio` — coerente, mas a fila de mensagens não tem essa trava.

## B. Proposta de implementação (5 blocos, dependentes nesta ordem)

**Bloco 1 — Higiene do histórico e identidade (base de tudo)**
- Deixar de gravar `lead_sincronizado` quando nada mudou.
- Revisar o status PENDENTE para valer só enquanto o lead está em NOVOS aguardando processamento.
- Registrar movimentação manual como evento próprio, distinto de sincronização.

**Bloco 2 — Campos protegidos e edição no card**
- Novo campo de campos travados manualmente (nome, telefone) em `crm_leads`/`portal_leads`; sincronização passa a respeitar a trava e registra "origem divergente" em vez de sobrescrever.
- Editar no card do Portal dos Leads (nome, telefone) com evento `alteracao_manual`.
- Primeiro nome como padrão nas mensagens (a função `firstName` já existe).

**Bloco 3 — Regra NOVOS x reengajamento**
- Nova função pura: está na coluna de entrada + possui **qualquer outra etiqueta operacional do funil** → reengajamento; sem nenhuma outra → E0.
- `resolveEntryFlow` passa a receber esse sinal, mantendo `entry_count` como reforço, não como único critério.
- Remover o botão "Reenviar boas-vindas" e qualquer caminho manual de reabrir janela para E0.

**Bloco 4 — Resposta automática à E0 com botão dinâmico**
- Ao receber resposta dentro da janela aberta, responder uma única vez com a orientação e o botão "Falar com o executivo", usando o telefone do executivo responsável (perfil), nunca fixo.

**Bloco 5 — Ocorrências E20 / E27 / Finalização**
- Nova tabela de **ocorrências** (uma linha por geração): lead, executivo, token/slug do link, gerado_em, expira_em (7 dias corridos), eventos de envio/acesso/conclusão, E27 prevista, finalização prevista, status.
- Ação "Gerar E20" no card: cria a ocorrência, monta a mensagem com primeiro nome, permite copiar, registra tudo. Gerar ≠ lead respondeu.
- E27 = 7 dias corridos após a geração; finalização = próximo dia útil após o vencimento (sábado/domingo → segunda).
- OPORTUNIDADE encerra a cadência ativa; encerrar nunca apaga nem esconde o lead.
- Reativação anos depois = **nova ocorrência**, histórico antigo intacto.

## C. Perguntas que preciso responder antes do comando definitivo

1. **A regra crítica**: quando o lead tem NOVOS + OPORTUNIDADES ao mesmo tempo, ele deve aparecer **na coluna NOVOS** do Portal (e ser tratado como reengajamento), ou permanecer visualmente em OPORTUNIDADES e apenas **não** receber E0? Isso muda o Kanban inteiro.
2. **"Outra tag operacional"** = qualquer etiqueta que seja coluna do funil (ZERO CONTATO, FRIOS, AGENDAMENTO, OPORTUNIDADES, COF/CONTRATO, REMARKETING), ou existe alguma que deva ser ignorada nessa checagem?
3. **Reengajamento**: usa o fluxo RE0–RE3 que já existe (e ele passa a ser assistido), ou é um fluxo novo?
4. **E20 e cadência**: gerar E20 **pausa** a cadência corrente (E1/E3/E4...) ou as duas convivem?
5. **E27 e finalização são automáticas ou assistidas?** Se automáticas, precisam de template oficial aprovado da Meta — hoje não existe template para essas finalidades.
6. **Telefone do executivo**: onde está a fonte oficial? `executive_profiles` não tem coluna de telefone hoje — precisa ser criada e preenchida por cada executivo.
7. **Link E20**: qual domínio/formato (`portal.velox.com.br/xxxxx`?) e o que o visitante vê depois de 7 dias — home do Portal ou página "link expirado"?
8. **Alteração manual**: a trava é permanente ou expira/pode ser destravada pelo administrador?
9. **Ordem de entrega**: aprova os 5 blocos nesta sequência, ou quer tudo em uma entrega única?
