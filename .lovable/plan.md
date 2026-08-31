# Arquitetura futura: E0 automática, Ação do Dia operacional, resultados estruturados e mensagens

Rodada de planejamento. Nada foi alterado: sem código, sem banco, sem cron, sem fila, sem interface, sem publicação. A Global WhatsApp Safety Lock permanece intacta.

Convenção: **[HOJE]** o que existe · **[FUTURO]** o que seria necessário · **[RECOMENDAÇÃO]** proposta técnica · **[RISCO]** conflitos a vigiar.

Nada descrito como [FUTURO] existe no sistema. E0…E8, "Pular", resultados estruturados e versões completas de mensagem são desenho, não estado atual.

---

## Diagnóstico atual (base de tudo)

- **Agendadores ativos (4):** `portal-crm-sync-automatico` (1 min), `remarketing-engine` (1 min), `portal-backup-automatico` (1 h), `portal-backup-processador` (1 min).
- **Módulos que alcançam o canal** (`whatsapp.server.ts`): `relationship/dispatch`, `relationship/e0`, `relationship/closure` (E27/Finalização), `relationship/inbound`, `remarketing/engine`, `campaigns`, `crm/messaging`, `crm/automation`, mais o webhook da Meta. São **oito caminhos de saída**, não um.
- **Motor:** `machine.ts` decide, `engine.ts` executa na mesma passagem; `executedSteps` em `relationship_cadences` é gravado no momento da decisão, não do resultado.
- **Ação do Dia:** `daily-actions.ts` é leitura — agrega 4 fontes, aplica precedência (AGENDA > REUNIÃO > MENSAGEM > LIGAÇÃO), colapsa por lead, chave determinística, buckets em America/Sao_Paulo. Não persiste e não recebe resultado.
- **Conteúdo:** `relationship_contents` + `relationship_step_content_bindings` resolvem texto e link **no momento da execução**.
- **Reuniões:** `portal_meetings` existe; `SCHEDULE_CREATED` pausa a cadência. Sem comparecimento, evolução ou reagendamento.
- **Vocabulário de resultado:** praticamente só `..._SENT`. Não há categoria comparável entre canais.

---

## 1. Motor de decisão x Ação do Dia

**[HOJE]** Decisão e execução na mesma passagem; a Ação do Dia só lê.

**[FUTURO]** O motor continua sendo a única inteligência, mas para E1+ ele apenas **registra** que existe uma ação.

**[RECOMENDAÇÃO]** Inserir uma camada fina entre decidir e executar — o **planejador** — sem tocar em `machine.ts`:

```text
MOTOR (machine.ts, única decisão)
   └─> PLANEJADOR (única escrita de ação; chave lead_id + etapa + ciclo)
         ├─ E0 ─> despachante (motivo E0_AUTOMATICA) ─> Safety Lock ─> canal
         └─ E1+ ─> AÇÃO DO DIA ─> executivo responde
                        └─> EVENTO DE RESULTADO (append-only)
                                 └─> MOTOR decide de novo
```

Duas mudanças de contrato tornam isso seguro:
- `executedSteps` passa a ser escrito **no resultado**, nunca no planejamento. Hoje é o que faz o motor "achar" que já executou.
- Um novo evento (`ACTION_COMPLETED`) é o gatilho para o motor decidir o próximo passo — em vez do tick decidir sozinho.

**[RISCO]** Se o `engine.ts` continuar executando E1+ enquanto o planejador já cria ações, existe duplo caminho. Por isso a fase de sombra da seção 13.

---

## 2. E0 como única automação

**[HOJE]** Oito caminhos alcançam o canal; só a Safety Lock os contém.

**[RECOMENDAÇÃO] — a regra como estrutura, não como disciplina:**
1. **Ponto único de saída obrigatório.** Já é quase verdade (todos importam `whatsapp.server.ts`); falta torná-lo contratual — ninguém fala com a Graph API direto.
2. **Whitelist server-side dentro desse ponto.** Todo envio exige um motivo explícito: `E0_AUTOMATICA`, `RESPOSTA_HUMANA` (janela de 24h) ou `ACAO_EXECUTADA_POR_HUMANO` (com `action_id` e usuário). Sem motivo válido: recusa + auditoria. Um cron antigo, um retry ou um caminho esquecido **não consegue produzir** um motivo válido.
3. **Etapa não é autorização.** Com motivo automático, o despachante recusa qualquer chave fora de `E0`/`E0_V1`.
4. **Caminhos a avaliar antes do corte:** `remarketing/engine` (cron próprio de 1 min — hoje é um segundo executor real), `campaigns`, `closure` (E27/Finalização), `inbound` (resposta automática), `crm/automation`.
5. **Safety Lock permanece** como última barreira, depois de tudo isso.

**[RISCO]** A whitelist só protege se nenhum módulo puder importar o cliente HTTP diretamente. Vale uma verificação estrutural, não só revisão de código.

---

## 3. Ação do Dia como fila operacional persistente

**[RECOMENDAÇÃO]** Preservar a lógica boa e mudar apenas a responsabilidade:

| Hoje | Futuro |
|---|---|
| chave determinística e dedupe | vira a **chave única no banco** (`lead_id + etapa + ciclo`) |
| precedência e colapso por lead | permanece, operando sobre a tabela de ações |
| `resolveBucket` / ordenação | permanece — atraso é leitura de tempo, nunca exclusão |
| agregação de 4 fontes | deixa de agregar; passa a ler a tabela alimentada pelo planejador |
| `crm_cadence_tasks` | vira **somente leitura**: histórico e ancoragem, nunca cria ação |

Campos: `action_id`, `lead_id`, `etapa`, `tipo`, `responsável`, `prevista_para`, `estado` (`PLANEJADA` · `EXECUTADA` · `PULADA` · `REAGENDADA` · `BLOQUEADA`), `resultado`, `justificativa`, `observação`, `origem`, `ciclo`.

- **Não desaparece:** fica `PLANEJADA` até haver resultado, pulo ou reagendamento. "Atrasada" é `prevista_para < agora` — leitura, não estado.
- **Não duplica:** chave única no banco + um único caminho de escrita (decisão imediata e ciclo periódico entram pela mesma função).
- **Não é recriada:** o motor só planeja etapa que ainda não tem ação naquele ciclo; a chave única bloqueia o resto fisicamente.

**Ergonomia:** a linha mostra só o essencial ("Reunião — 14:00 — Paulo Rogério Lima"; "Ligação — 2ª tentativa"), sem rótulos redundantes. Ao lado, sem sair da fila: abrir conversa, ficha completa em camada, notas anteriores, últimos eventos. O painel de resposta precisa de área maior que o card atual.

---

## 4. Resultado da ação

**[HOJE]** Só eventos de envio; nada comparável entre canais.

**[RECOMENDAÇÃO] Vocabulário fechado por tipo de ação, nunca texto livre:**

| Tipo | Campos categóricos |
|---|---|
| Ligação | `atendeu` (sim/não), `tentativa` (n) |
| Reunião | `compareceu`, `evolucao` (só se compareceu), `reagendar` |
| Mensagem | `realizada` (sim/não) |
| Qualquer | `sem_contato` (bool), `observação` (texto livre, **nunca lido por regra**) |

Regras:
- Toda decisão futura do motor lê **apenas** campos categóricos. Observação é para gente, não para máquina.
- Cada resposta grava um **evento append-only** (`action_id`, `lead_id`, usuário, timestamp, campos). Nada é sobrescrito.
- O evento é o gatilho: o motor recebe `ACTION_COMPLETED` + resultado e decide a etapa seguinte. Sem o resultado, o motor não avança — é isso que impede a fila de correr sozinha.

**[RISCO]** Se algum resultado ficar como string livre "por enquanto", o relatório da seção 12 nasce inviável. O vocabulário precisa ser fechado desde o primeiro dia.

---

## 5. "Pular" uma ação

**[RECOMENDAÇÃO]** Pular é **estado da ação**, não resultado de execução — essa distinção é o que separa de "executou e deu negativo":

- `estado = PULADA` com `justificativa` (validada no servidor: não vazia, tamanho mínimo), `pulada_por`, `pulada_em`, `action_id`, `lead_id`, e `destino` (`reagendada para <data>` ou `encerrada no ciclo`).
- **Nunca** entra em `executedSteps` — pular não é execução.
- Três categorias que nunca se somam: realizada (com resultado positivo ou negativo), pulada, não respondida.
- "Não consegui contato" é resultado de execução (tentou), **não** pulo. "Estava em outra reunião" é pulo (não tentou). A pergunta "deseja reagendar?" existe nos dois casos e é o que define o `destino`.
- Auditoria trivial: tudo categórico + append-only, filtrável por executivo, período e motivo.
- Visual com identidade própria (neutra/âmbar), nunca vermelha — pular não é falha.

---

## 6. Reuniões e reagendamento

**[RECOMENDAÇÃO]**
- A ação **referencia** `portal_meetings` e não copia nada: horário, nome e telefone são lidos da reunião original. Uma reunião = no máximo uma ação aberta (chave única) — duplicidade impossível por construção.
- Aparece na fila em `início − janela` (5 min). `daily-actions.ts` já faz isso com 15 min; basta parametrizar.
- Reunião passada fica **atrasada com prioridade máxima** até ter resposta. Nada expira por horário.
- Cascata de resposta exatamente como descrito: compareceu → evoluiu; não compareceu → deseja reagendar.
- Reagendar em **uma transação**: reunião original encerrada com resultado, nova reunião criada, nova ação apontando para a anterior. A ação antiga fica `REAGENDADA` para sempre.
- "Não compareceu" gera **evento estruturado**; a interface nunca escolhe qual fluxo de retomada usar — quem decide é o motor.

---

## 7. Identidade do lead e notas

**[HOJE]** A base já é orientada a ID (`portal_leads.id`, `can_access_investor`, `current_executive_id`). **[LIMITE]** Não há amarração formal entre "ação exibida" e "nota gravada" — a nota depende do contexto de tela.

**[RECOMENDAÇÃO] Validação em três níveis, com pesos diferentes:**
- **Interface:** envia **apenas** o `action_id`. Nunca `lead_id`, nunca nome. É conveniência, não segurança.
- **Servidor (onde a regra vive):** recebe `action_id`, **deriva** o `lead_id` da própria ação, confere acesso via `can_access_investor` e só então grava. `lead_id` vindo do cliente é ignorado.
- **Banco:** chave estrangeira da nota para a ação e para o lead + RLS com as funções existentes. Nota órfã ou cruzada torna-se fisicamente impossível.

Nome é campo de exibição, jamais chave de busca em nenhum caminho de escrita. Notas são append-only.

---

## 8. Mensagens com versões completas

**Sim, a simplificação é recomendável.** A montagem em tempo de execução é a fonte natural de divergência entre texto e link, e impede reconstruir o que foi realmente enviado.

**[RECOMENDAÇÃO] Cada versão é um registro próprio:** etapa, número da versão, rótulo (com nome / sem nome), texto completo, link completo, ativa/inativa.
- Imutabilidade por linha: a ação aponta para o `id` da versão; o histórico nunca muda.
- Alterar texto **cria versão nova**; a antiga continua existindo só para leitura. Não existe edição retroativa de mensagem já usada.
- Ativar/desativar uma versão sem tocar nas outras; contagem de uso por versão fica trivial.
- Versões dentro de um único registro (JSON) reabririam o problema de montagem — não recomendo.

**Sem quebrar o histórico:** mensagens já enviadas continuam apontando para o par conteúdo+binding atual; as novas apontam para versões. O histórico lê os dois formatos. Nada é migrado à força.

---

## 9. Rotação entre versões

| | Aleatória | Determinística por lead | Sequência por lead |
|---|---|---|---|
| Reprodutibilidade | nenhuma | total | depende de contador persistido |
| Retry | pode entregar versão diferente | sempre a mesma | pode avançar indevidamente |
| Auditoria | só se o sorteio for gravado | derivável do `lead_id` | exige ler o contador |
| Distribuição | uniforme só em volume | uniforme e estável | uniforme |
| Homologação | não reproduzível | reproduzível | parcial |

**Recomendação: determinística por lead** (distribuição a partir do ID), **e** gravar a versão escolhida na ação. Assim nem sequer é preciso recalcular depois — o histórico é literal. Aleatório só valeria para teste A/B estatístico, que não é o objetivo.

---

## 10. Novas etapas (E4…E8) sem contaminar o histórico

**[RECOMENDAÇÃO] Vocabulário versionado, não renomeação:**
1. **Nunca renomear chaves existentes.** E0, E1, E3, E4, E12, E30 e os fluxos V/RE/RF continuam com as chaves já gravadas em `executedSteps` e nos eventos. Renomear reescreveria o passado.
2. **Novas etapas nascem com chaves novas e distintas** (prefixo de geração), mesmo quando o rótulo humano for parecido.
3. **Cada cadência guarda a versão do vocabulário** com que nasceu. Leads antigos terminam no vocabulário antigo; novos nascem no novo. Nunca há conversão no meio do caminho.
4. **Declaração única** em `config.ts` / `step-registry.ts`, com etapa marcada `ativa` ou `planejada`. Etapa `planejada` existe na configuração e na documentação, mas o planejador nunca cria ação para ela e o despachante a recusa. É exatamente assim que podemos discutir E4–E8 sem que o sistema as trate como existentes.
5. Mapa antigo→novo é decisão de vocês e vira **tabela de correspondência para relatório**, nunca migração de dados.

---

## 11. Ações manuais e WhatsApp

**[RECOMENDAÇÃO]** Registrar execução manual **sem** transformar isso em autorização:
- A confirmação do executivo grava `estado = EXECUTADA` + `resultado` + `executada_por` + timestamp. É um **registro de fato ocorrido**, não uma ordem de envio.
- Registrar nunca dispara nada: o caminho de escrita da ação e o caminho de saída para o canal são módulos separados, e o segundo exige motivo de autorização.
- Se o executivo optar por enviar **pelo sistema**, aí sim o despachante é chamado com motivo `ACAO_EXECUTADA_POR_HUMANO` + `action_id` + usuário — rastreável e ainda atrás da Safety Lock.
- O uso livre do WhatsApp/CRM continua exatamente como hoje; ele apenas não alimenta o motor sozinho.

**[RISCO]** Confiar na confirmação humana significa que "executada" pode não corresponder ao mundo real. É aceitável e auditável (quem confirmou, quando), mas deve ser explícito para a gestão.

---

## 12. Auditoria do dia do executivo

**[RECOMENDAÇÃO]** Todas as perguntas listadas são respondidas por contagem sobre a tabela de ações + eventos, sem interpretar texto:

- ações do dia = ações com `prevista_para` no dia e `responsável` = executivo
- realizadas = `EXECUTADA` · não realizadas = `PLANEJADA` no fim do dia · puladas = `PULADA` · reagendadas = `REAGENDADA`
- ligações tentadas = ações tipo ligação `EXECUTADA` (com `tentativa`) · não atenderam = `atendeu = não`
- reuniões sem comparecimento = `compareceu = não` · mensagens realizadas = tipo mensagem + `realizada = sim`
- justificativas = campo `justificativa` das puladas, exibido junto do `lead_id`

Cada linha carrega `action_id` e `lead_id`; o clique abre o card do investidor **por ID**, em camada sobre a tela. Nada é reconstruído depois: o número existe porque o evento foi gravado quando aconteceu. Filtros por executivo, período, tipo e resultado sobre colunas indexadas.

---

## 13. Migração e segurança

**[RECOMENDAÇÃO] Quatro fases, com marco de corte:**
1. **Sombra** — o planejador grava ações a partir das decisões do motor, mas nada é apresentado nem executado. Sistema atual idêntico. Serve para comparar o que o planejador teria criado x o que o motor fez.
2. **Apresentação** — a Ação do Dia lê a tabela de ações. Despacho automático só para E0. Ligações legadas viram somente leitura.
3. **Corte** — o despachante recusa tudo fora da whitelist; `remarketing-engine` é reclassificado ou desligado; `closure` e `inbound` passam a exigir motivo explícito; o `engine.ts` deixa de executar E1+.
4. **Consolidação** — relatório, notas por ID e biblioteca de versões.

Neutralizações:
- **dois motores** — decisão nunca sai de `machine.ts`; o planejador transcreve, a Ação do Dia apresenta;
- **duplicação** — chave única no banco + caminho único de escrita;
- **avalanche** — só etapas com vencimento **a partir do marco de ativação** viram ação; o passado permanece histórico. Mais teto de itens por ciclo e ordenação por vencimento;
- **perda de histórico** — nada é migrado, renomeado ou sobrescrito; eventos append-only;
- **etapa manual enviada automaticamente** — não existe motivo de autorização automático para ela; a recusa é estrutural.

**[RISCO]** O resgate de cadências por `msg_e0_%` no tick pode ressuscitar leads antigos durante a migração; e a fila de E0 adiada tem janela de 3 dias e limite de 200 — pendências fora disso somem silenciosamente. Ambos precisam ser tratados antes da fase 2.

---

## 14. Safety Lock

A trava permanece intacta e como **última** barreira, nunca como a única. A ordem futura de verificação deve ser:

```text
motivo de autorização válido? → etapa permitida para esse motivo? → destinatário permitido (ambiente)? → SAFETY LOCK → canal
```

Cada camada recusa sozinha. Assim, no dia em que a trava eventualmente for liberada, nada muda de comportamento: os caminhos que hoje só não enviam por causa dela já terão sido recusados três passos antes. **É por isso que a whitelist precisa existir antes da liberação, não depois** — hoje, se a trava saísse, oito caminhos passariam a enviar de verdade.

---

## 15. Resumo em linguagem simples

Hoje o sistema pensa e age no mesmo instante: quando decide que é hora de falar com alguém, ele já tenta falar. E existem oito portas diferentes por onde uma mensagem pode sair — nenhuma sai de verdade só porque há um cadeado geral na frente de todas.

O modelo que estamos desenhando separa três papéis:
- **quem pensa** — o motor, que continua sendo o único a decidir qual é o próximo passo de cada investidor;
- **quem organiza** — uma lista de tarefas onde cada passo vira uma tarefa com dono, prazo e situação;
- **quem faz** — o executivo, na Ação do Dia, que executa e diz o que aconteceu.

O sistema só age sozinho no primeiro contato (E0). Todo o resto é trabalho humano: o sistema lembra, organiza e registra, mas não fala no lugar de ninguém. Isso não depende de alguém lembrar da regra — as portas de saída passam a exigir uma "senha" que só o primeiro contato e as ações humanas possuem.

As tarefas não somem quando atrasam: continuam visíveis até alguém dizer o que houve. O executivo responde em opções objetivas (atendeu, compareceu, evoluiu, quer remarcar) e, quando não conseguir realizar, pode pular explicando o motivo — o que fica registrado com nome, hora e destino, e nunca é confundido com "tentou e não deu certo".

Tudo é amarrado pelo código interno do investidor, nunca pelo nome — então uma anotação nunca pode cair na pessoa errada. As mensagens deixam de ser montadas na hora: cada versão já nasce completa, com texto e link juntos, e o que foi enviado nunca muda depois.

No fim, a gestão consegue perguntar "o que esse executivo tinha para fazer hoje e o que aconteceu com cada item" e receber uma resposta exata, porque cada resposta foi registrada no momento em que aconteceu — não reconstruída depois.

A implantação seria em quatro passos, começando por um período em que o novo modelo apenas observa, sem mudar nada.

---

## Decisões de negócio ainda pendentes

1. Mapa oficial das etapas atuais para a numeração futura E0…E8 e o conteúdo dos fluxos de retomada.
2. Os fluxos `visualizacao`, `reentrada` e `RF` permanecem no vocabulário novo?
3. Pular consome a etapa ou ela pode voltar?
4. Após "não compareceu", a cadência retoma na etapa seguinte à última executada?
5. Remarketing e campanhas: automáticos, manuais ou desligados?
6. Resposta automática (`inbound`) continua automática?
7. Ação pendente expira após N dias úteis ou fica indefinidamente?
8. Quantas tentativas de ligação por ciclo e com que rótulos?
9. Quem pode pular: só o responsável ou também a gestão?
10. Ações anteriores ao marco de corte entram na Ação do Dia ou ficam só como histórico?
11. Confirmação de "mensagem enviada" é sempre obrigatória?
