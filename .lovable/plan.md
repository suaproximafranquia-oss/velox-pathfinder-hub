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

---

# Segunda rodada — decisões pendentes fechadas

Nenhuma implementação, migration, alteração de banco, dados ou interface nesta etapa.

## 1. AGENDAMENTO na fila de ligações?

Alternativas: (A) só cadência de mensagens; (B) mensagens + ligações; (C) só ligações.

**Recomendação: (A) somente cadência de mensagens.**

- **Motivo técnico**: os dois motores usam gatilhos diferentes. `cadence.ts` (ligações) parte da ENTRADA em etapa passiva (ZERO CONTATO / FRIO) — o lead não atende, então o sistema insiste. AGENDAMENTO é uma etapa ATIVA: já existe compromisso marcado, e a ligação relevante é a da reunião, que não pertence à fila L2–L5. Colocar AGENDAMENTO em `ELIGIBLE_STAGE_KEYS` de ligações geraria tarefas L2/L3/L4 concorrendo com a reunião real.
- **Impacto**: `ELIGIBLE_STAGE_KEYS` de ligações permanece `zero_contato`, `frio`. A elegibilidade de AGENDAMENTO passa a existir apenas no motor de mensagens/instância (`relationship/`).
- **Regressão**: baixa. Nenhuma tarefa existente muda; apenas não se criam novas.
- **Tipo**: regra de negócio (a elegibilidade de mensagens já é separada da de ligações).

## 2. Segunda E20 com uma ocorrência ainda válida

Alternativas: (A) substituir/cancelar a anterior; (B) impedir; (C) permitir simultâneas.

**Recomendação: (A) substituir, com confirmação explícita do executivo.**

- **Motivo**: (C) viola diretamente o princípio de "nunca dois relógios"; (B) engessa o caso real de o lead perder o link ou trocar de número. (A) preserva o histórico (a ocorrência antiga fica `substituida`, com `expires_at` truncado e o token invalidado) e mantém um único relógio ativo.
- **Impacto**: a tabela de ocorrências E20 precisa de status (`ativa`, `substituida`, `expirada`, `concluida`) e índice parcial garantindo no máximo uma `ativa` por lead. E27/finalização recalculam a partir da nova geração.
- **Regressão**: risco de o link antigo continuar válido se o token não for revogado — o resgate deve validar a OCORRÊNCIA no banco, não apenas a assinatura HMAC.
- **Tipo**: estrutural (status + unicidade parcial + validação de resgate por ocorrência).

## 3. RE0 automático ou assistido?

**Recomendação: (B) assistido — Ação do Dia.**

- **Motivo**: a regra do ecossistema é "E0 é o único primeiro contato automático". O lead de reengajamento já tem histórico, já pode ter sido atendido, pode ter dito não, pode ter reunião passada. Disparar automaticamente arrisca reabordagem indevida de alguém que já conhece a operação. O executivo lê o histórico e envia.
- **Impacto**: `machine.ts` continua abrindo a instância no fluxo `reentrada` a partir de RE0, mas RE0 nasce como item ASSISTIDO na fila (mensagem pronta para copiar) em vez de despacho automático. RE1–RE3 seguem o mesmo padrão assistido enquanto não houver template oficial aprovado.
- **Regressão**: nenhuma — hoje o fluxo de reentrada praticamente não é acionado, pois a regra de entrada está incorreta.
- **Tipo**: regra de negócio + marcação de "modo de execução" (automático x assistido) por etapa na configuração.

## 4. Lead sem executivo responsável

**Recomendação: número institucional configurável, com bloqueio como padrão.**

Regra objetiva, em cascata:
1. WhatsApp do executivo responsável (`executive_profiles.whatsapp`).
2. Se não houver responsável ou o responsável não tiver número: usar o número institucional cadastrado em configuração operacional (não em código).
3. Se o institucional não estiver configurado: **não renderizar o botão** e enviar apenas o texto de orientação.

- **Motivo**: nunca inventar número e nunca herdar o número de outro executivo. O fallback institucional é uma decisão da gestão, feita uma vez e auditável.
- **Impacto**: nova coluna `whatsapp` em `executive_profiles` + chave institucional em `crm_automation_settings`. O botão é resolvido no servidor no momento do envio, nunca no cliente.
- **Regressão**: hoje o número está fixo em `src/lib/executive-auth.ts` (`5517997727337` para todos). Ao migrar, perfis sem número cadastrado cairiam no institucional — a migração deve popular o valor atual como ponto de partida, sem apagar nada.
- **Tipo**: estrutural (dois campos) + regra de negócio (cascata).

## 5. Limite de repetição da resposta automática na janela de 24h

**Recomendação: no máximo 1 resposta automática por janela de 24h aberta, com carência mínima de 12 horas entre duas respostas automáticas ao mesmo lead.**

Regra objetiva:
- Só dispara em reação a uma mensagem RECEBIDA (nunca "do nada").
- Uma única vez por janela: enquanto `window_open_until` não expirar, novas mensagens do lead não geram nova resposta automática.
- Nova janela aberta depois da expiração pode gerar nova resposta, respeitando a carência de 12h.
- Se o executivo já respondeu humanamente na janela (`last_executive_reply_at` dentro dela), a resposta automática é suprimida — a conversa já é humana.

- **Motivo**: protege contra loop (lead que manda cinco mensagens seguidas), contra spam entre janelas curtas e contra a situação absurda de o robô interromper uma conversa humana em andamento.
- **Impacto**: usa campos que já existem em `relationship_cadences` (`window_open_until`, `last_inbound_at`, `last_outbound_at`, `last_executive_reply_at`); acrescenta apenas um marcador de "última resposta automática enviada".
- **Regressão**: baixa; o comportamento atual é reativo.
- **Tipo**: regra de negócio + um campo de carimbo.

## 6. E30 continua sendo etapa oficial?

**Recomendação: retirar E30 como etapa fixa da cadência e mantê-la apenas como histórico.**

- **Motivo**: E30 foi concebida como "reativação por calendário" (≈30 dias após o início da jornada), o que só fazia sentido enquanto a cadência era um trilho único e cronológico. No modelo de instâncias, o retorno tardio do lead é tratado por um EVENTO (E20 gerada pelo executivo), que abre uma nova instância com relógio próprio. Manter E30 criaria um segundo mecanismo de reativação, automático e por calendário, competindo com o E20 manual — exatamente o "dois motores" que a arquitetura proíbe.
- **Estado atual**: `E30_ENABLED = false` em `src/lib/relationship/reactivation.ts` — nada é agendado nem enviado hoje, e nunca houve texto oficial aprovado. Retirá-la é, na prática, formalizar o estado real.
- **Conceito final**: o fluxo sem resposta encerra em **E12**; a reativação posterior é **E20 → E27 (+7 dias corridos) → finalização (dia útil)**. Registros históricos de E30 que já existam permanecem intactos e legíveis na jornada.
- **Impacto**: `E30` sai de `FLOW_SEQUENCE`/`STEPS` como etapa agendável, mas o valor continua aceito em `types.ts` para leitura de histórico. `reactivation.ts` deixa de ser fonte de agendamento.
- **Regressão**: nenhuma no comportamento atual (já desligada); a única precaução é não remover o literal `"E30"` do tipo, para não quebrar leitura de eventos antigos.
- **Tipo**: regra de negócio, com limpeza de configuração.

---

## CONTRADIÇÕES OU PONTOS AINDA NÃO FECHADOS

1. **Chave da etapa AGENDAMENTO**: o código usa `agendamentos` (plural, `src/lib/crm/integrations.ts`), enquanto as regras falam em AGENDAMENTO. Precisa haver uma única chave canônica, senão o motor de mensagens e o board discordarão sobre o mesmo lead.
2. **Quem encerra a instância na OPORTUNIDADE**: a etapa vem do GreenSales por sincronização. Se um executivo mover o lead direto no GreenSales, o encerramento só acontece na próxima varredura — existe uma janela em que a fila ainda pode disparar. Precisa ficar definido se o cancelamento é verificado também no momento do despacho (recomendado) ou só na sincronização.
3. **Lead que volta de OPORTUNIDADE para ZERO/FRIO**: OPORTUNIDADE é terminal para a instância. Se a origem devolver o lead para uma etapa anterior, isso abre nova instância automaticamente ou exige ação do executivo? Hoje não há regra.
4. **E20 durante cadência ativa**: ficou definido que "pausa". Falta dizer se a instância pausada pode ser RETOMADA depois (por exemplo, E20 expira sem resposta) ou se é encerrada de vez. Recomendo encerrar: retomar reintroduz dois relógios.
5. **Precedência manual e reversão**: definiu-se que a edição manual vence a sincronização e é reversível. Falta definir QUEM reverte (só gestão? o próprio autor?) e se a reversão volta ao valor do GreenSales atual ou ao valor original.
6. **Fonte do texto durante a transição da Biblioteca**: enquanto os grupos `FINALIZACAO`, `RE1` e `RE2` estiverem vazios, o motor precisa de uma regra explícita — falhar a etapa, ou cair no texto atual de `messages.ts`. Sem essa definição, a Fase 3 pode silenciar etapas.
7. **Remarketing na jornada compartilhada**: o ambiente é isolado por telefone, e um mesmo telefone pode existir em Remarketing e no Portal. Falta definir o critério de vínculo (telefone normalizado, presumo) e se o vínculo é retroativo às campanhas já enviadas.
8. **"Ação do Dia" como conceito único**: ligações (L2–L5), etapas assistidas de mensagem, RE0–RE3, E27 e finalização vão todos para a mesma fila do dia. Falta a regra de prioridade e de limite diário por executivo, senão a lista fica impraticável.
9. **Definição de "tag de etapa"**: a regra NOVOS + qualquer outra tag depende de uma lista fechada de tags que contam como etapa do funil. Tags operacionais soltas (LEAD FORM TAG, campanhas) não podem transformar um lead novo em reengajamento por engano.
