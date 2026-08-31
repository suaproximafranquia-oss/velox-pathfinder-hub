# Ação do Dia, execução manual, agendamentos, auditoria e mensagens

Rodada de planejamento. Nada foi alterado: sem código, sem banco, sem cron, sem envio. A Global WhatsApp Safety Lock permanece intacta.

Convenção: **[ATUAL]** existe hoje · **[PARCIAL]** existe em outra forma · **[LIMITE]** limitação confirmada · **[FUTURO]** conceito ainda não implantado · **[RECOMENDAÇÃO]** proposta técnica.

Verificado nesta rodada: agendadores ativos no banco, os módulos que alcançam `whatsapp.server.ts`, `config.ts`, `machine.ts`, `step-registry.ts`, `daily-actions.ts`, `cadence.server.ts`.

---

## 1. E0 automática x demais etapas manuais

**[ATUAL] Agendadores ativos no banco (4):**
- `portal-crm-sync-automatico` — a cada 1 minuto (sincronização de leads → E0 → tick do motor)
- `remarketing-engine` — a cada 1 minuto (executor próprio, independente do motor)
- `portal-backup-automatico` — de hora em hora
- `portal-backup-processador` — a cada 1 minuto

**[ATUAL] Módulos que alcançam o canal (`whatsapp.server.ts`):** `relationship/dispatch.server.ts`, `relationship/e0.server.ts`, `relationship/closure.server.ts` (E27/Finalização), `relationship/inbound.server.ts` (resposta automática), `remarketing/engine.server.ts`, `campaigns.server.ts`, `crm/messaging.server.ts`, `crm/automation.server.ts`, além do webhook da Meta.

**[LIMITE]** São **oito** caminhos de saída, não um. Hoje só a Safety Lock os contém.

**[RECOMENDAÇÃO] — a regra como estrutura, não como disciplina:**
1. **Ponto único de saída obrigatório.** Nenhum módulo fala com a Graph API diretamente; todos passam por uma única função de despacho. Isso já é quase verdade (todos importam `whatsapp.server.ts`) — falta torná-lo contratual.
2. **Whitelist server-side dentro desse ponto único.** A função exige, em todo envio, um `motivo de autorização` explícito: `E0_AUTOMATICA`, `RESPOSTA_HUMANA` (executivo dentro da janela de 24h) ou `ACAO_EXECUTADA_POR_HUMANO` (com id da ação e do usuário). Qualquer chamada sem um desses é recusada e auditada. Um cron antigo, um retry ou um caminho esquecido simplesmente não consegue produzir um motivo válido.
3. **Etapa não é autorização.** O despachante recebe a etapa e recusa qualquer chave fora de `E0`/`E0_V1` quando o motivo é automático.
4. **Remarketing e campanhas** ficam sob a mesma regra: hoje têm executor próprio e cron próprio — precisam ser reclassificados como "envio humano autorizado" ou desligados no modelo futuro. Decisão de negócio pendente.
5. **Safety Lock permanece** como última barreira, depois de tudo isso.

---

## 2. Ação do Dia como fila operacional

**[PARCIAL]** Hoje `daily-actions.ts` é uma camada de leitura muito bem construída: chave determinística, precedência entre fontes, colapso por lead ("um lead = uma ação visível"), buckets temporais em America/Sao_Paulo. **[LIMITE]** Não persiste nada e não recebe resultado.

**[RECOMENDAÇÃO] Reaproveitar e mudar responsabilidade:**

| Peça atual | Futuro |
|---|---|
| chave determinística e dedupe | vira a **chave única no banco** da ação (`lead_id + etapa + ciclo`) |
| precedência entre fontes e colapso por lead | permanece igual, mas operando sobre a tabela de ações |
| `resolveBucket` / ordenação | permanece — atraso continua sendo leitura de tempo |
| agregação de 4 fontes | deixa de agregar; passa a **ler a tabela de ações**, que o planejador alimenta |
| `crm_cadence_tasks` (ligações) | vira **somente leitura**: histórico e ancoragem, nunca criador de ação nova |

A Ação do Dia **nunca decide etapa** — ela apresenta e coleta resultado. Isso é o que impede o segundo motor.

Campos da ação [FUTURO]: `action_id`, `lead_id`, `etapa`, `tipo`, `responsável`, `prevista_para`, `estado`, `resultado`, `observação`, `referência de origem`, `ciclo`, além dos eventos vinculados.

---

## 3. Reunião / agendamento

**[ATUAL]** `portal_meetings` existe (25 colunas) e `SCHEDULE_CREATED` pausa a cadência. **[LIMITE]** Não há comparecimento, evolução, reagendamento nem não comparecimento registrados.

**[RECOMENDAÇÃO]**
- A ação de reunião **referencia** `portal_meetings` e não copia nada: horário, nome e telefone continuam sendo lidos da reunião original. Uma reunião = no máximo uma ação aberta.
- Disponibilidade calculada no servidor como `início − janela`, com a janela parametrizada (5 min para reunião). `daily-actions.ts` já tem exatamente essa mecânica com 15 min — é só parametrizar.
- Reunião passada permanece `atrasada` com prioridade máxima até ter resposta; nada expira por horário.
- Resultado estruturado: `compareceu` (bool), `evolucao` (bool, só quando compareceu), `reagendar` (bool), `observação` (texto, nunca lido por regra).
- Reagendar em **uma transação**: reunião original encerrada, nova reunião criada, nova ação com ponteiro para a anterior. A ação antiga fica `REAGENDADA` para sempre.
- "Não compareceu" gera um **evento estruturado** que o motor lê; a interface nunca escolhe qual R usar.

---

## 4. Regra de "Pular"

**[FUTURO]** Não existe hoje em nenhuma forma.

**[RECOMENDAÇÃO]** Pular é **estado da ação**, não resultado de execução:
- `estado = PULADA`, com `justificativa` (validada no servidor: não vazia, comprimento mínimo), `pulada_por` (usuário), `pulada_em`, `action_id`, `lead_id`.
- Nunca entra em `executedSteps` — pular não consome a etapa da cadência (decisão pendente de vocês, ver seção 10).
- Nunca é contado como realizada nem como resultado negativo: são três categorias distintas no relatório.
- Visualmente, identidade própria (neutra/âmbar), nunca vermelha.

---

## 5. Relatório administrativo

**[FUTURO]** Não existe. **[PARCIAL]** As fontes brutas existem (`crm_cadence_tasks` com `outcome`, `relationship_message_sends`, `relationship_engine_log`), mas em vocabulários diferentes por canal — não são comparáveis hoje.

**[RECOMENDAÇÃO]**
- O relatório lê **eventos de ação**, nunca texto. Todo indicador vem de campos categóricos (`tipo`, `estado`, `resultado`), com previstas = todas as ações criadas no período, realizadas = `EXECUTADA`, não atendidas = `EXECUTADA` + `nao_atendeu`, puladas = `PULADA`, bloqueadas = `BLOQUEADA`.
- Filtros por executivo, período, tipo e resultado, sobre colunas indexadas.
- Cada linha carrega `action_id` e `lead_id`; o clique abre o card do investidor por ID, em camada sobre a tela — sem rota nova nem busca por nome.
- Nada é reconstruído depois: o número existe porque o evento foi gravado no momento em que aconteceu.

---

## 6. ID como regra master

**[ATUAL]** A base já é orientada a ID: `portal_leads.id` é a identidade, `can_access_investor` e `current_executive_id` decidem acesso por ID, `daily-actions.ts` carrega `leadId`. **[LIMITE]** Não há amarração formal entre "ação exibida" e "nota gravada" — a nota depende do contexto de tela.

**[RECOMENDAÇÃO] Validação nos três níveis, com pesos diferentes:**
- **Interface**: envia apenas o `action_id`. Nunca envia `lead_id`, nunca envia nome. É conveniência, não segurança.
- **Servidor** (onde a regra vive): recebe o `action_id`, **deriva** o `lead_id` da ação, confere que o usuário pode acessar aquele investidor (`can_access_investor`) e só então grava. Se o cliente mandar um `lead_id`, ele é ignorado.
- **Banco**: chave estrangeira da nota para a ação e para o lead, e RLS usando as funções já existentes. Torna fisicamente impossível uma nota órfã ou cruzada.

---

## 7. Notes do executivo / Workspace

**[RECOMENDAÇÃO]** Sem segunda fonte: o resultado da ação **é** o registro. O Workspace não guarda cópia — ele lê o agregador cronológico já existente (`journey.server.ts`), que passa a incluir os eventos de ação. O texto exibido ("Agendamento realizado — 31/08 14:00 · compareceu: SIM · evolução: SIM · observação: …") é **renderização** dos campos categóricos, nunca um texto armazenado e reinterpretado. Notas são append-only: nova nota, nunca sobrescrita.

---

## 8. Mensagens do Motor — versões completas

**[PARCIAL]** Hoje `relationship_contents` + `relationship_step_content_bindings` resolvem conteúdo e link **no momento da execução**. **[LIMITE]** Conteúdo e link podem divergir, e o histórico não guarda o que exatamente foi montado.

**[RECOMENDAÇÃO] Cada versão como registro próprio.** Motivos:
- imutabilidade por linha (a ação aponta para o `id` da versão e o histórico nunca muda);
- rotação e auditoria triviais (contar usos por versão);
- ativar/desativar uma versão sem tocar nas outras.
Tratar versões como "variações de uma mesma mensagem" num único registro obrigaria versionar por JSON e reabriria o problema de montagem.

Estrutura da versão: etapa, número da versão, rótulo (com nome / sem nome), texto completo, link completo, ativa/inativa. Texto publicado é imutável — alteração cria versão nova.

**Sem quebrar o histórico antigo:** as mensagens já enviadas continuam apontando para o par conteúdo+binding atual. As novas apontam para versões. O histórico lê os dois formatos; nada é migrado à força.

**Rotação:** determinística (distribuição pelo ID do lead) — reproduzível e auditável. Aleatório impediria reproduzir o que aconteceu.

---

## 9. Estratégia de migração

**[RECOMENDAÇÃO] Quatro fases, com marco de corte:**

1. **Sombra** — o planejador grava ações a partir das decisões do motor, mas nada é apresentado nem executado. O sistema atual continua exatamente como está. Serve para comparar: o que o planejador teria criado x o que o motor fez.
2. **Apresentação** — a Ação do Dia passa a ler a tabela de ações. O despachante automático continua ligado apenas para E0. As ligações legadas viram somente leitura.
3. **Corte** — o despachante recusa tudo fora da whitelist; `remarketing-engine` é reclassificado ou desligado; `closure` e `inbound` recebem motivo de autorização explícito.
4. **Consolidação** — relatório, notas por ID e biblioteca de versões.

**Anti-avalanche:** só etapas com vencimento **a partir da data de ativação** viram ação; o passado permanece histórico. Além disso, teto de itens por ciclo e ordenação por vencimento.

**Anti-duplicidade:** um único caminho de escrita (decisão imediata e ciclo periódico entram pela mesma função), chave única no banco, e nenhuma criação de ação fora do planejador.

---

## 10. Recomendação consolidada e decisões pendentes

```text
MOTOR (única decisão, código atual preservado)
   └─> PLANEJADOR (única escrita de ação: lead_id + etapa + ciclo, único)
         ├─ E0 / E0_V1 ─> despachante (motivo: E0_AUTOMATICA) ─> Safety Lock ─> canal
         └─ E1+ ────────> AÇÃO DO DIA ─> executivo responde
                               └─> evento de resultado (append-only)
                                        ├─> MOTOR decide de novo
                                        ├─> Workspace/Notes (leitura, por ID)
                                        └─> Relatório (leitura, por categorias)
```

**Riscos que eu vigiaria:**
- o `remarketing-engine` rodando a cada minuto é hoje um segundo executor real — precisa de decisão explícita antes da fase 3;
- `closure` e `inbound` também alcançam o canal e não passam pelo tick do motor;
- o resgate de cadências por `msg_e0_%` no tick pode ressuscitar leads antigos na migração;
- a fila de E0 adiada tem janela de 3 dias e limite de 200 — pendências fora disso desaparecem silenciosamente;
- quando a Safety Lock um dia for retirada, qualquer caminho esquecido passa a enviar de verdade. Por isso a whitelist precisa estar pronta **antes**, não depois.

**Decisões de negócio ainda necessárias:**
1. Mapa oficial das etapas atuais (E0, E1, E3, E4, E12, E30) para a numeração futura E0…E8, e o conteúdo de R4.
2. Os fluxos `visualizacao` (V3/V4), `reentrada` (RE0–RE3) e `RF` permanecem?
3. Pular consome a etapa ou ela pode voltar?
4. Após "não compareceu", o R retoma na etapa seguinte à última executada?
5. Remarketing e campanhas: permanecem automáticos, viram ação manual ou são desligados?
6. Resposta automática (`inbound`) continua automática?
7. Validade de uma ação pendente: indefinida ou expira após N dias úteis?
8. Rotação de versões: por lead, por executivo ou sequência global?
9. Quem pode pular: só o responsável ou também a gestão?
10. "Sem interesse" (resultado estruturado futuro) encerra a cadência ou apenas suspende?
11. Ações anteriores ao marco de corte entram na Ação do Dia ou ficam só como histórico?
12. Confirmação de "mensagem enviada" é sempre obrigatória, ou copiar basta em algum caso?
