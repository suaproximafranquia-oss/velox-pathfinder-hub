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

---

# Terceira rodada — fechamento das regras funcionais

Somente validação. Nada foi implementado, criado ou alterado (banco, código, migration, dados, interface). As confirmações H, I, J, K e L permanecem válidas e inalteradas.

## A) Regras totalmente claras (confirmadas, sem pendência)

1. **AGENDAMENTO** — confirmado e coerente. Mensagens sim, ligações não. Os dois motores são independentes: `cadence.ts` decide ligações por `ELIGIBLE_STAGE_KEYS` (`zero_contato`, `frio`) e o motor `relationship/` decide mensagens por estado da instância. Efeito colateral: nenhum. Nenhuma tarefa de ligação já criada é afetada; apenas não se criam novas para quem está em AGENDAMENTO. Ligações agendadas manualmente pelo executivo continuam possíveis — a regra só desliga a fila automática.
2. **Segunda E20 (opção B — impedir)** — abordagem segura e mais conservadora que a substituição. Garante um único relógio por lead por construção. Regra final: existe no máximo uma ocorrência E20 `ativa` por lead; a tentativa de gerar outra é recusada com aviso; após expiração, conclusão ou encerramento manual, uma nova geração cria uma ocorrência nova e independente. **Consequência a aceitar**: se o lead perder o link, o executivo precisa encerrar a ocorrência atual antes de gerar outra — por isso a ocorrência precisa de uma ação explícita de "encerrar E20" no card, senão o executivo fica travado por até 7 dias.
3. **Reengajamento assistido** — confirmado. E0 é o único primeiro contato automático; RE0–RE3 nascem como Ação do Dia, com mensagem pronta. Preserva o princípio e evita reabordar automaticamente quem já foi atendido.
4. **E30 retirada como etapa fixa** — confirmado. `E30_ENABLED` já é `false`, nada é agendado hoje. O conceito passa a ser **E20 → E27 (+7 dias corridos) → FINALIZAÇÃO (dia útil)**. O literal `E30` permanece apenas para leitura de histórico antigo.
5. **Finalização derivada da E20 (item 7)** — confirmado exatamente como descrito: o sistema acompanha a OCORRÊNCIA, não a coluna. ZERO → FRIO → AGENDAMENTO não interrompem nada. Resposta do lead + evolução para OPORTUNIDADE encerram a ocorrência e suprimem a finalização.
6. **Retorno anos depois (item 8)** — confirmado. Nova ocorrência = nova instância, novo link, novo ciclo de 7 dias, novo histórico. O ciclo antigo (incluindo E30 histórica) permanece intacto e legível.
7. **Regra NOVOS + tags em ponto único (item 9)** — confirmado. Uma única função de decisão, consumida por sincronização, intake e board. Nenhuma tela reimplementa a regra.
8. **E0 / CRM (item 13)** — confirmado. Sem "Reenviar boas-vindas", sem seletor de templates de cadência. O CRM permanece como canal humano dentro da janela aberta.
9. **Histórico falso (item 14)** — confirmado. Sem alteração: apenas `last_synced_at`. Nenhum evento, nota ou "interação" é produzido. O histórico antigo é preservado.
10. **Precedência manual (item 15)** — confirmado, com registro de override (campo, valor, autor, data/hora) e detecção da divergência externa sem sobrescrita.
11. **Primeiro nome (item 16)** — confirmado. Normalização na renderização; histórico enviado nunca é reescrito.

## Regra recomendada para o item 5 — repetição da resposta automática

Escalonamento em três níveis, por lead:

1. **Primeira resposta do lead** (janela recém-aberta): resposta completa — explica que o ambiente é automatizado, nomeia o executivo responsável e apresenta o botão "Falar com o executivo".
2. **Nova resposta do lead dentro da mesma janela de 24h**: **nenhuma nova mensagem automática**. A orientação já foi dada; repetir dentro do mesmo dia é ruído.
3. **Nova janela aberta depois (novo ciclo)**: resposta **curta** — uma linha + o botão. Aplica-se carência mínima de 24h desde a última resposta automática.
4. **Limite de 3 respostas automáticas por lead em 30 dias**: atingido o limite, o motor silencia e a conversa fica pendente para o executivo na Ação do Dia.
5. **Supressão imediata**: se houver resposta humana do executivo dentro da janela, nenhuma resposta automática é emitida naquela janela.

Por que é seguro: cada disparo exige uma mensagem recebida (nunca "do nada"), o teto por janela impede loop imediato, a carência impede spam entre janelas curtas e o teto mensal garante que o robô nunca substitua o executivo indefinidamente.

## B) Pontos que ainda possuem ambiguidade (precisam da sua decisão)

1. **Encerrar E20 manualmente** — com a opção B, o executivo pode precisar cancelar uma ocorrência ativa (lead trocou de número, link perdido). Existe esse botão "encerrar E20" e quem pode usar: qualquer responsável ou só gestão?
2. **E20 gerada durante cadência ativa** — a instância anterior é **pausada** ou **encerrada**? Recomendo encerrar: pausar e retomar depois reintroduz dois relógios. Preciso da sua confirmação.
3. **Retorno de OPORTUNIDADE para etapa anterior** — se a origem devolver o lead, isso abre nova instância automaticamente ou exige ação do executivo? Recomendo exigir ação.
4. **Lista fechada de "tags de etapa"** — a regra NOVOS + tag depende de saber quais tags contam como etapa do funil (ZERO CONTATO, FRIO, AGENDAMENTO, OPORTUNIDADE...) e quais são operacionais e devem ser ignoradas (LEAD FORM TAG, campanhas, REMARKETING). Preciso da lista oficial.
5. **Número institucional de fallback (item 4)** — recomendo a cascata: executivo responsável → número institucional configurável → **botão não renderizado** se nenhum existir. Nunca herdar número de outro executivo. Preciso saber se o número institucional será cadastrado (e por quem) ou se a regra fica em "bloquear o botão".
6. **Fonte do texto durante a transição da Biblioteca** — enquanto grupos como `FINALIZACAO`, `RE1` e `RE2` estiverem vazios, o motor deve falhar a etapa ou usar o texto atual como fallback? Recomendo falhar visivelmente na Ação do Dia, para não enviar texto não aprovado.
7. **Prioridade e teto diário da Ação do Dia** — ligações, etapas assistidas, RE0–RE3, E27 e finalização compartilham a mesma fila. Falta a ordem de prioridade e se existe limite diário por executivo.

## C) Conflitos técnicos encontrados e D) solução recomendada

| Conflito | Solução recomendada |
| --- | --- |
| Chave da etapa: o código usa `agendamentos` (plural) em `src/lib/crm/integrations.ts`, as regras falam AGENDAMENTO | Fixar uma chave canônica única e mapear as variações no ponto de entrada, nunca em cada consumidor |
| OPORTUNIDADE chega por sincronização — existe janela em que a fila ainda dispara | Verificar o estágio atual também no momento do despacho, não só na varredura |
| `relationship_cadences` é uma linha por lead; instâncias exigem várias | Migração aditiva: `instance_seq` + `active`; todos os leitores passam a filtrar `active = true`; a linha atual vira a instância 1 |
| Biblioteca como fonte única x textos fixos em `messages.ts` | Migração por finalidade, com a etapa bloqueada (e visível) enquanto não houver versão aprovada |
| Duplicidade mensagem x conteúdo (item 12) | Separar claramente: **mensagem** (texto versionado, por finalidade) e **conteúdo** (vídeo/arquivo, por grupo). A mensagem referencia o grupo, nunca embute o arquivo — é assim que hoje já funciona com `contentGroup`, então não há duplicidade |
| Jornada consolidada x cópia física de registros (itens 10 e 11) | Não copiar. Uma leitura consolidada (view/serviço) sobre as tabelas de origem, com `source_env`, `kind`, `preview` e referência ao snapshot. Notas do Executivo consomem a mesma leitura, com regra de expansão: mensagens expandem para o snapshot exato; ligações permanecem em linha única |
| Remarketing x Portal: mesmo telefone em dois ambientes | Vínculo por telefone normalizado, aplicado na leitura consolidada; o Remarketing continua isolado nos seus próprios cards e tabelas |

## E) A arquitetura está pronta para implementação em fases?

Sim, **assim que os 7 pontos da seção B forem respondidos**. Todo o restante está fechado e coerente. A ordem de fases permanece:

1. Higiene e identidade (histórico falso, NOVOS x tags, remoção dos controles do CRM, override manual, telefone do executivo).
2. Instâncias e E20 (instância, OPORTUNIDADE terminal, ocorrência E20, link de 7 dias, E27, finalização).
3. Biblioteca versionada e congelamento das mensagens.
4. Jornada consolidada, notas e eventos de Remarketing.

Nenhuma decisão foi assumida por conta própria: os itens da seção B aguardam sua resposta antes de qualquer construção.

---

# Quarta rodada — fechamento final das 6 decisões

Nada foi implementado, criado ou alterado nesta etapa.

## A) Confirmação das 6 decisões incorporadas

1. **AGENDAMENTO** — elegível para cadência de MENSAGENS; não entra na fila automática de LIGAÇÕES. Canais independentes. OPORTUNIDADE encerra qualquer cadência. **Incorporado.**
2. **SEGUNDA E20** — nunca substitui nem sobrescreve. Com uma ocorrência ativa, a geração é impedida. Depois de encerrada/expirada, uma nova geração cria uma NOVA instância. Cada ocorrência fica historicamente intacta. **Incorporado** (substitui a recomendação anterior de "substituir": prevalece a sua regra).
3. **REENGAJAMENTO** — RE0–RE3 assistido, via Ação do Dia. E0 automática só para lead realmente novo. NOVOS sozinho = novo; NOVOS + qualquer outra tag de etapa = reengajamento; REMARKETING fora da decisão. **Incorporado.**
4. **LEAD SEM EXECUTIVO** — sem fallback algum. O botão "Falar com o executivo" só aparece com responsável + telefone cadastrado; caso contrário é ocultado e a ausência é registrada como pendência de configuração. **Incorporado** (cancela a proposta anterior de número institucional).
5. **RESPOSTA AUTOMÁTICA** — apenas com janela aberta por mensagem recebida; no máximo UMA por janela; nova janela permite nova resposta; sempre com primeiro nome do lead e executivo responsável correspondente. **Incorporado** (prevalece "uma por janela", sem teto mensal adicional).
6. **E30** — retirada como etapa fixa. Modelo definitivo: **GERAR E20 → link 7 dias corridos → E27 (+7 corridos) → FINALIZAÇÃO da ocorrência (regra de dia útil)**. A finalização não se chama E30. OPORTUNIDADE antes disso cancela a finalização. Após a finalização, a instância encerra. **Incorporado.**

Todas as decisões anteriores (H, I, J, K, L, imutabilidade por snapshot, jornada consolidada, precedência manual, fim do `lead_sincronizado` vazio, remoção de "Reenviar boas-vindas" e do seletor de templates) permanecem válidas e inalteradas.

## B) Conflitos com a arquitetura existente

Todos com solução conhecida e não bloqueante:

1. `relationship_cadences` é uma linha por lead → migração aditiva (`instance_seq`, `active`); a linha atual vira a instância 1; leitores filtram a ativa.
2. OPORTUNIDADE chega por sincronização → verificar o estágio também no momento do despacho, além da varredura.
3. Chave da etapa `agendamentos` (plural, em `src/lib/crm/integrations.ts`) x AGENDAMENTO → chave canônica única, normalizada na entrada.
4. Telefone do executivo hoje é literal em `src/lib/executive-auth.ts` → passa a coluna em `executive_profiles`; sem valor cadastrado, botão oculto (decisão 4).
5. Motor usa textos fixos em `src/lib/relationship/messages.ts`, com grupos `FINALIZACAO`, `RE1`, `RE2` vazios → a Biblioteca vira fonte oficial na Fase 3; até lá o texto atual permanece, e etapas sem versão aprovada ficam visivelmente bloqueadas.
6. `E30_ENABLED = false` já hoje → retirá-la como etapa não muda comportamento; o literal `E30` permanece apenas para leitura de histórico.
7. `issueToken` tem TTL global de 30 dias → passa a aceitar TTL por emissão, e o resgate valida a OCORRÊNCIA, não só a assinatura.

## C) Decisões adicionais ainda necessárias

Nenhuma bloqueante. Ficam como ajustes de execução, com o padrão que adotarei se você não indicar outro:

1. **Encerrar E20 manualmente** — como a segunda geração é impedida, o card terá a ação "encerrar ocorrência E20", disponível ao responsável e à gestão. Padrão adotado: disponível para ambos, com registro de autor e motivo.
2. **E20 gerada com cadência ativa** — padrão adotado: a instância anterior é **encerrada** (não pausada), evitando dois relógios; o histórico permanece intacto.
3. **Lista oficial de "tags de etapa"** — padrão adotado: contam como etapa apenas as tags espelhadas nas colunas do funil (ZERO CONTATO, FRIO, AGENDAMENTO, OPORTUNIDADE e equivalentes cadastradas em `crm_pipeline_stages`); tags operacionais (LEAD FORM TAG, campanhas, REMARKETING) são ignoradas.
4. **Retorno de OPORTUNIDADE para etapa anterior** — padrão adotado: não reabre cadência automaticamente; depende de ação do executivo.
5. **Prioridade na Ação do Dia** — padrão adotado: finalização vencida > E27 > etapas assistidas de mensagem (RE0–RE3) > ligações, ordenadas por atraso.

## D) Ordem final das fases

1. **Fase 1 — Higiene e identidade**: fim do evento `lead_sincronizado` sem alteração; regra NOVOS x tags em ponto único; remoção de "Reenviar boas-vindas" e do seletor de templates; edição manual de nome/telefone com precedência e override auditável; campo de WhatsApp no perfil do executivo com botão condicional.
2. **Fase 2 — Instâncias, E20 e finalização**: `instance_seq`/`active`; OPORTUNIDADE terminal com cancelamento de fila; ocorrência E20 (link 7 dias, generated_at/expires_at, autor, snapshot); E27 +7 corridos; finalização por dia útil na Ação do Dia; RE0–RE3 assistido.
3. **Fase 3 — Biblioteca e congelamento**: mensagens versionadas por finalidade, vídeos vinculados por grupo, snapshot obrigatório no envio.
4. **Fase 4 — Jornada consolidada**: leitura única entre Portal, Workspace e Remarketing; notas manuais; prévia com reticências e expansão para o snapshot exato; eventos de remarketing com data, hora e campanha.

**Arquitetura fechada para implementação.**

---

# Quinta rodada — confirmação de entendimento (itens 1 a 14)

Nada implementado. Todos os pontos abaixo já estão incorporados às rodadas anteriores; nenhuma decisão nova foi assumida.

| Item | Entendimento | Status |
| --- | --- | --- |
| 1. Coluna x tag | Coluna define posição; tags são histórico. Exceção única: NOVOS sozinho = novo (E0); NOVOS + qualquer tag de etapa = reengajamento. REMARKETING fora. Regra central única, sem variantes por combinação. | Fechado |
| 2. E0 | Automática, uma vez por entrada real. Sem "Reenviar boas-vindas". Template centralizado. Janela de 24h respeitada; dentro dela não é preciso template. | Fechado |
| 3. Resposta automática | Só com janela aberta por mensagem recebida. Orienta e apresenta botão dinâmico com o WhatsApp do executivo responsável (perfil). Uma por janela; suprimida quando o executivo já está conversando. | Fechado |
| 4. Cadência | ZERO, FRIO e AGENDAMENTO elegíveis para mensagens. OPORTUNIDADE encerra instância e cancela fila. Movimentação entre as três não encerra nada. | Fechado |
| 5. Instâncias | Cadência vira entidade com instâncias; ciclos antigos preservados; nova instância tem relógio, etapas, eventos e encerramento próprios. | Fechado |
| 6. E20 como ação | Botão "GERAR E20" no card, disponível mesmo após finalização anterior. Registra link, momento, executivo, instância, validade e expiração; inicia o relógio da ocorrência. | Fechado |
| 7. Mensagem E20 | Editável na Biblioteca; primeiro nome usado de forma natural, sem abertura padronizada obrigatória. | Fechado |
| 8. Link E20 | 7 dias corridos a partir da GERAÇÃO, token próprio, individual; após expirar, acesso bloqueado com página de conteúdo expirado. | Fechado (a página de expirado é novidade desta rodada e entra na Fase 2) |
| 9. E27 | +7 dias corridos da geração, sem deslocamento por fim de semana. Nome operacional, não dia do mês. | Fechado |
| 10. Finalização | No próprio prazo final; sábado/domingo → segunda. Sem empurrar dias. Mensagem respeitosa de encerramento temporário. | Fechado |
| 11. Nova E20 após finalização | Cria nova instância independente; a antiga (inclusive E30 histórica) não é reaberta nem sobrescrita. | Fechado |
| 12. OPORTUNIDADE | Único estado que mata a instância. AGENDAMENTO não encerra. | Fechado |
| 13. Biblioteca de mensagens | Fonte oficial de E1, E2, E3, E4, E12, E20, E27, FINALIZAÇÃO, RE0–RE3 etc. Edição gera nova versão para envios futuros; cada envio congela id, versão, texto original, texto renderizado, data/hora, lead, executivo e instância. | Fechado |
| 14. Vídeos | Mensagem referencia grupo de conteúdo; vídeos permanecem vinculados à finalidade correta, sem duplicar mensagem e conteúdo. | Fechado — **o item 14 chegou cortado na sua mensagem**; se havia mais regras sobre vídeos, envie o trecho restante antes da implementação |

Único acréscimo real desta rodada: **página de conteúdo expirado** para o link E20 vencido, incluída na Fase 2.

A ordem das fases permanece: 1) Higiene e identidade · 2) Instâncias, E20, E27 e finalização · 3) Biblioteca versionada e congelamento · 4) Jornada consolidada e Remarketing.

**Arquitetura fechada para implementação**, pendente apenas do trecho final do item 14.
