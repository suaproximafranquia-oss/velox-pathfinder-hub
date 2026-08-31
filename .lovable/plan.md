# Arquitetura futura: E0 automática, Ação do Dia operacional, cadência manual e mensagens

Rodada de planejamento. Nada foi alterado: sem código, sem banco, sem cron, sem fila, sem interface. A Global WhatsApp Safety Lock permanece intacta.

Convenção: **[ATUAL]** existe hoje · **[PARCIAL]** existe em outra forma · **[LIMITE]** limitação confirmada · **[FUTURO]** conceito ainda não implantado · **[RECOMENDAÇÃO]** proposta técnica.

Nada nas seções [FUTURO] existe no sistema. E0…E8, R4, "Pular", resultados estruturados de reunião e versões completas de mensagem são desenho, não estado atual.

---

## Diagnóstico do que existe hoje

**[ATUAL] Agendadores ativos no banco (4):**
- `portal-crm-sync-automatico` — a cada 1 minuto (sincronização de leads → E0 → tick do motor)
- `remarketing-engine` — a cada 1 minuto (executor próprio, independente do motor)
- `portal-backup-automatico` — de hora em hora
- `portal-backup-processador` — a cada 1 minuto

**[ATUAL] Módulos que alcançam o canal (`whatsapp.server.ts`):** `relationship/dispatch.server.ts`, `relationship/e0.server.ts`, `relationship/closure.server.ts` (E27/Finalização), `relationship/inbound.server.ts` (resposta automática), `remarketing/engine.server.ts`, `campaigns.server.ts`, `crm/messaging.server.ts`, `crm/automation.server.ts`, além do webhook da Meta.

**[ATUAL] Motor:** `machine.ts` decide e `engine.ts` executa na mesma passagem; `relationship_cadences` guarda o estado do lead e `executedSteps` é gravado no momento da decisão, não no do resultado. Vocabulário de eventos limitado a `..._SENT` e afins.

**[ATUAL] Ação do Dia:** `daily-actions.ts` é camada de leitura — agrega 4 fontes, aplica precedência (AGENDA > REUNIÃO > MENSAGEM > LIGAÇÃO), colapsa por lead, usa chave determinística e buckets em America/Sao_Paulo. Não persiste e não recebe resultado.

**[ATUAL] Conteúdo:** `relationship_contents` + `relationship_step_content_bindings` resolvem texto e link **no momento da execução**.

**[ATUAL] Reuniões:** `portal_meetings` existe; `SCHEDULE_CREATED` pausa a cadência. Não há comparecimento, evolução nem reagendamento registrados.

**[LIMITE] consolidado:** oito caminhos de saída em vez de um; decisão e execução acopladas; nenhuma ação com estado próprio; nenhum vocabulário comum de resultado entre canais.

---

## 1. Separar E0 automática das etapas manuais sem criar um segundo motor

**[RECOMENDAÇÃO] — a regra como estrutura, não como disciplina.** O motor atual continua sendo o único que decide; nenhuma linha de decisão é duplicada. O que muda é quem pode executar.

1. **Ponto único de saída obrigatório.** Nenhum módulo fala com a Graph API diretamente; todos passam por uma única função de despacho. Já é quase verdade (todos importam `whatsapp.server.ts`) — falta torná-lo contratual.
2. **Whitelist server-side dentro desse ponto único.** Todo envio exige um motivo de autorização explícito: `E0_AUTOMATICA`, `RESPOSTA_HUMANA` (executivo dentro da janela de 24h) ou `ACAO_EXECUTADA_POR_HUMANO` (com id da ação e do usuário). Chamada sem motivo válido é recusada e auditada. Um cron antigo, um retry ou um caminho esquecido simplesmente não consegue produzir um motivo válido.
3. **Etapa não é autorização.** O despachante recebe a etapa e recusa qualquer chave fora de `E0`/`E0_V1` quando o motivo é automático.
4. **Remarketing, campanhas, `closure` e `inbound`** ficam sob a mesma regra: hoje têm caminho próprio. Precisam ser reclassificados como "envio humano autorizado" ou desligados. Decisão de negócio pendente.
5. **Safety Lock permanece** como última barreira, depois de tudo isso.

Por que isso não cria um segundo motor: a whitelist não decide nada — ela apenas recusa. A única fonte de decisão continua sendo `machine.ts`.

---

## 2. Ação do Dia como fila operacional persistente

**[RECOMENDAÇÃO] Reaproveitar a lógica existente e mudar apenas a responsabilidade:**

| Peça atual | Futuro |
|---|---|
| chave determinística e dedupe | vira a **chave única no banco** da ação (`lead_id + etapa + ciclo`) |
| precedência entre fontes e colapso por lead | permanece igual, operando sobre a tabela de ações |
| `resolveBucket` / ordenação | permanece — atraso continua sendo leitura de tempo, nunca exclusão |
| agregação de 4 fontes | deixa de agregar; passa a **ler a tabela de ações**, alimentada pelo planejador |
| `crm_cadence_tasks` (ligações) | vira **somente leitura**: histórico e ancoragem, nunca criador de ação nova |

Campos da ação [FUTURO]: `action_id`, `lead_id`, `etapa`, `tipo`, `responsável`, `prevista_para`, `estado` (`PLANEJADA` · `EXECUTADA` · `PULADA` · `REAGENDADA` · `BLOQUEADA`), `resultado`, `observação`, `referência de origem`, `ciclo`, mais os eventos vinculados.

**Ação atrasada nunca desaparece:** o estado é `PLANEJADA` até haver resultado, pulo ou reagendamento. "Atrasada" é uma leitura de `prevista_para < agora`, não uma mudança de estado nem uma expiração.

A Ação do Dia **nunca decide etapa** — apresenta e coleta resultado. É exatamente isso que impede o segundo motor.

---

## 2b. Contexto na tela e ergonomia

**[RECOMENDAÇÃO]** A linha da ação carrega só o essencial: tipo + horário + nome ("Reunião — 14:00 — Paulo Rogério Lima"), sem repetir rótulos redundantes ("pendente", "reunião com investidor"). Tentativa de ligação aparece no próprio rótulo ("Ligação — 2ª tentativa"), derivada do contador de tentativas do ciclo — sem abrir o histórico.

Ao lado, ações rápidas sem sair da fila: abrir conversa, abrir ficha completa em camada sobre a tela, ver notas anteriores, ver últimos eventos. O painel de resposta (resultado, justificativa, observação, reagendamento) precisa de área maior que a atual — provavelmente um painel lateral ou tela dedicada, não um card estreito.

Tudo isso é leitura por `action_id` → `lead_id`; nenhuma tela busca por nome.

---

## 3. "Pular com justificativa"

**[RECOMENDAÇÃO]** Pular é **estado da ação**, não resultado de execução — essa é a separação que impede confundir com "executou e deu negativo":

- `estado = PULADA`, com `justificativa` (validada no servidor: não vazia, comprimento mínimo), `pulada_por` (usuário), `pulada_em`, `action_id`, `lead_id`.
- Nunca entra em `executedSteps` — pular não é execução.
- Três categorias distintas e nunca somadas: realizada com resultado (positivo ou negativo), pulada, não respondida.
- Auditoria: como é campo categórico + evento append-only, a gestão filtra por executivo, período e motivo sem interpretar texto.
- Visualmente identidade própria (neutra/âmbar), nunca vermelha — pular não é falha.

---

## 4. Reuniões

**[RECOMENDAÇÃO]**
- A ação de reunião **referencia** `portal_meetings` e não copia nada: horário, nome e telefone continuam sendo lidos da reunião original. Uma reunião = no máximo uma ação aberta (chave única). Isso elimina duplicidade por construção.
- Disponibilidade calculada no servidor como `início − janela` (5 min). `daily-actions.ts` já tem essa mecânica com 15 min — basta parametrizar.
- Reunião passada permanece `atrasada` com prioridade máxima até ter resposta.
- Resultado estruturado: `compareceu` (bool), `evolucao` (bool, só quando compareceu), `reagendar` (bool), `observação` (texto livre, nunca lido por regra).
- Reagendar em **uma transação**: reunião original encerrada, nova reunião criada, nova ação com ponteiro para a anterior. A ação antiga fica `REAGENDADA` para sempre — histórico preservado, nada sobrescrito.
- "Não compareceu" gera um **evento estruturado** que o motor lê; a interface nunca escolhe qual fluxo de retomada usar.

---

## 5. Mensagens com versões completas — é recomendável?

**Sim, é mais seguro e previsível.** A montagem em tempo de execução é a fonte natural de divergência entre texto e link, e impede reconstruir o que foi realmente enviado.

**[RECOMENDAÇÃO] Cada versão como registro próprio.** Motivos:
- imutabilidade por linha: a ação aponta para o `id` da versão e o histórico nunca muda;
- rotação e auditoria triviais (contar usos por versão);
- ativar/desativar uma versão sem tocar nas outras.

Tratar versões como variações dentro de um único registro obrigaria versionar por JSON e reabriria o problema de montagem.

Estrutura da versão: etapa, número da versão, rótulo (com nome / sem nome), texto completo, link completo, ativa/inativa. **Texto publicado é imutável** — alterar cria versão nova, e a versão antiga continua existindo apenas para leitura do histórico. Nunca há edição retroativa de mensagem já usada.

**Sem quebrar o histórico antigo:** mensagens já enviadas continuam apontando para o par conteúdo+binding atual; as novas apontam para versões. O histórico lê os dois formatos; nada é migrado à força.

---

## 6. Rotação: aleatória x determinística

| | Aleatória | Determinística por lead |
|---|---|---|
| Reprodutibilidade | nenhuma — não dá para responder "por que este lead recebeu a versão 2" | total |
| Auditoria | depende de gravar o sorteio; se falhar, perde-se | derivável do próprio `lead_id` |
| Reexecução / retry | pode entregar versão diferente da planejada | sempre a mesma |
| Distribuição | uniforme só no volume grande | uniforme e estável |
| Homologação | não reproduzível | reproduzível |

**Recomendação: determinística por lead** (distribuição a partir do ID). Além disso, a versão escolhida é gravada na ação — então mesmo a determinística não depende de recalcular depois. Aleatório só valeria a pena para teste A/B estatístico, que não é o objetivo aqui.

---

## 7. Introduzir E4…E8 sem confundir o histórico atual

**[RECOMENDAÇÃO] Vocabulário versionado, não renomeação.**

1. **Nunca renomear chaves existentes.** As etapas atuais (E0, E1, E3, E4, E12, E30, fluxos V/RE/RF) permanecem exatamente com as chaves que já estão gravadas em `relationship_cadences.executedSteps` e nos eventos. Renomear reescreveria o significado do passado.
2. **Novas etapas nascem com chaves novas e distintas** (por exemplo, um prefixo de geração), sem colidir com nenhuma chave já usada — inclusive quando o rótulo humano for parecido.
3. **Cada cadência guarda a versão do vocabulário** com que foi iniciada. O motor lê essa marca e aplica o conjunto de regras daquela versão. Leads antigos terminam no vocabulário antigo; leads novos nascem no novo. Nunca há conversão no meio do caminho.
4. **Declaração em um único lugar** (`config.ts` / `step-registry.ts`), com etapa marcada como `ativa` ou `planejada`. Etapa `planejada` é visível na documentação e na configuração, mas o planejador nunca cria ação para ela e o despachante a recusa. É assim que E5–E8 podem existir no código sem existir na operação.
5. **Mapa oficial antigo→novo é decisão de vocês** e vira uma tabela de correspondência para relatório, nunca uma migração de dados.

---

## 8. Ordem segura de implantação

**[RECOMENDAÇÃO] Quatro fases, com marco de corte:**

1. **Sombra** — o planejador grava ações a partir das decisões do motor, mas nada é apresentado nem executado. O sistema atual continua idêntico. Serve para comparar: o que o planejador teria criado x o que o motor fez.
2. **Apresentação** — a Ação do Dia passa a ler a tabela de ações. O despacho automático continua ligado apenas para E0. Ligações legadas viram somente leitura.
3. **Corte** — o despachante recusa tudo fora da whitelist; `remarketing-engine` é reclassificado ou desligado; `closure` e `inbound` passam a exigir motivo explícito.
4. **Consolidação** — relatório, notas por ID e biblioteca de versões.

Como cada risco é neutralizado:
- **dois motores** — a decisão nunca sai de `machine.ts`; o planejador só transcreve e a Ação do Dia só apresenta;
- **duplicação** — chave única no banco (`lead_id + etapa + ciclo`) e um único caminho de escrita, usado tanto pela decisão imediata quanto pelo ciclo periódico;
- **disparo indevido** — whitelist por motivo de autorização, e a Safety Lock atrás dela;
- **avalanche** — só etapas com vencimento **a partir do marco de ativação** viram ação; o passado permanece histórico. Mais teto de itens por ciclo e ordenação por vencimento;
- **perda de histórico** — nada é migrado, renomeado ou sobrescrito; eventos são append-only;
- **etapa manual enviada automaticamente** — a etapa manual não tem motivo de autorização automático possível; a recusa é estrutural.

---

## Recomendação consolidada

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
- `remarketing-engine` rodando a cada minuto é hoje um segundo executor real — decisão explícita necessária antes da fase 3;
- `closure` e `inbound` também alcançam o canal sem passar pelo tick do motor;
- o resgate de cadências por `msg_e0_%` no tick pode ressuscitar leads antigos durante a migração;
- a fila de E0 adiada tem janela de 3 dias e limite de 200 — pendências fora disso somem silenciosamente;
- quando a Safety Lock um dia for retirada, qualquer caminho esquecido passa a enviar de verdade. A whitelist precisa estar pronta **antes**, não depois.

**Decisões de negócio ainda necessárias:**
1. Mapa oficial das etapas atuais para a numeração futura E0…E8, e o conteúdo dos fluxos de retomada.
2. Os fluxos `visualizacao`, `reentrada` e `RF` permanecem no vocabulário novo?
3. Pular consome a etapa ou ela pode voltar?
4. Após "não compareceu", a cadência retoma na etapa seguinte à última executada?
5. Remarketing e campanhas: automáticos, manuais ou desligados?
6. Resposta automática (`inbound`) continua automática?
7. Ação pendente expira após N dias úteis ou fica indefinidamente?
8. Rotação de versões: por lead, por executivo ou sequência global?
9. Quem pode pular: só o responsável ou também a gestão?
10. Quantas tentativas de ligação por ciclo e com que rótulos?
11. Ações anteriores ao marco de corte entram na Ação do Dia ou ficam só como histórico?
12. Confirmação de "mensagem enviada" é sempre obrigatória?
