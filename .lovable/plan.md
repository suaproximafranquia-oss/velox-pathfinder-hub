# Relatório consolidado de planejamento — Cadência, Motor, E0, Ação do Dia, Reuniões e Mensagens

Documento-base para as próximas etapas de construção. **Nada foi implementado**: sem código, sem banco, sem cron, sem rota, sem configuração. A Global WhatsApp Safety Lock permanece intacta.

**[HOJE]** existe e foi verificado · **[FUTURO]** apenas desenho · **[RECOMENDAÇÃO]** proposta técnica · **[RISCO]** conflito a vigiar.

Nada marcado [FUTURO] está implantado — inclusive E2, E4, E5, E6, E7, E8, "Pular", resultados estruturados, reagendamento, relatório e versões completas de mensagem.

---

## 0. O que existe hoje

**Agendadores ativos (4):** `portal-crm-sync-automatico` (1 min → sincroniza leads, E0 e tick do motor), `remarketing-engine` (1 min, executor próprio), `portal-backup-automatico` (1 h), `portal-backup-processador` (1 min).

**Oito caminhos alcançam o canal** (`whatsapp.server.ts`): `relationship/dispatch`, `relationship/e0`, `relationship/closure` (E27/Finalização), `relationship/inbound`, `remarketing/engine`, `campaigns`, `crm/messaging`, `crm/automation`, mais o webhook da Meta.

**Motor:** `machine.ts` decide, `engine.ts` executa **na mesma passagem**. `productionEngine()` já monta o motor por injeção (repositório, despachante, relógio, config, `leadContext`) — é essa arquitetura que torna a evolução viável sem reescrita.

**Ação do Dia:** `daily-actions.ts` é camada pura de leitura, e declara isso no próprio cabeçalho: não cria tarefa, não altera cadência, não escreve. Agrega 4 fontes (`portal_meetings`, `workspace_agenda_events`, `relationship_queue`, `crm_cadence_tasks`), tem chave determinística (`source:lead:etapa:instância`), precedência de fonte (meeting 0 → agenda 1 → closure 2 → queue 3 → cadence 4), colapso "um lead = uma ação visível" com `secondary`, buckets (`agora`/`atrasada`/`hoje`/`futura`) e fuso America/Sao_Paulo vindo do servidor.

**Ligações:** `cadence.server.ts` recalcula a fila a cada leitura a partir do estado do lead + histórico; `completeCadenceTask` grava `status DONE` + `outcome` SIM/NÃO + evento `CADENCE_TASK_DONE`. Já existe `step_key` textual (`L1`, `L2`…) além do `step_day`.

**Travas:** `guard.server.ts` valida destinatário por escopo (homologação exige prefixo `TEST-`; produção exige lead real com telefone válido). `execution-mode.server.ts` decide simulação pelo ambiente, não por constante. A Safety Lock fica depois de tudo isso.

**Conteúdo:** `relationship_contents` + `relationship_step_content_bindings` resolvem texto e link **no momento da execução**.

**Reuniões:** `portal_meetings` existe e `SCHEDULE_CREATED` pausa a cadência; não há comparecimento, evolução, reagendamento nem não comparecimento.

**Etapas atuais:** E0, E1, E3, E4, E12, E30 e os fluxos `visualizacao`, `reentrada` e RF. **Não correspondem** à jornada futura E0…E8.

**[LIMITE] estrutural:** `executedSteps` (em `relationship_cadences`) é gravado **no momento da decisão**, não do resultado. É a raiz do acoplamento entre decidir e executar.

---

## 1. Como evoluir sem criar dois motores

**[RECOMENDAÇÃO]** Não se cria motor novo: aproveita-se a injeção de dependências que `productionEngine()` já usa. Entra **uma** peça nova entre decidir e executar — o **planejador** — e o despachante ganha uma condição.

```text
MOTOR (machine.ts — única decisão, não reescrito)
   └─> PLANEJADOR (única escrita de ação; chave lead_id + etapa + ciclo)
         ├─ E0 ──> DESPACHANTE (motivo E0_AUTOMATICA)
         │            └─> guard de escopo → SAFETY LOCK → canal
         └─ E1+ ─> TABELA DE AÇÕES ─> AÇÃO DO DIA (apresenta, não decide)
                        └─> executivo responde
                               └─> EVENTO DE RESULTADO (append-only)
                                        ├─> MOTOR decide de novo
                                        ├─> Notas / Workspace (leitura por ID)
                                        └─> Relatório (leitura por categorias)
```

Três mudanças de contrato sustentam tudo:
1. **`executedSteps` passa a ser escrito no resultado**, nunca no planejamento. Sem isso, qualquer outra proteção é cosmética.
2. **`engine.ts` deixa de executar E1+** — continua executando só E0 e entrega o resto ao planejador.
3. **Novo evento `ACTION_COMPLETED`** é o gatilho para o motor decidir o próximo passo, em vez de o tick decidir sozinho.

E, para tornar o envio automático de etapa manual **estruturalmente impossível**: whitelist server-side no ponto único de saída, exigindo motivo explícito em todo envio — `E0_AUTOMATICA`, `RESPOSTA_HUMANA` (janela de 24 h) ou `ACAO_EXECUTADA_POR_HUMANO` (com `action_id` + usuário). Sem motivo válido: recusa + auditoria. Um cron antigo, um retry ou um caminho esquecido não consegue produzir motivo válido. Com motivo automático, o despachante recusa qualquer chave fora de `E0`/`E0_V1`.

---

## 2. Como cadastrar etapas futuras sem reconstruir o motor

**[RECOMENDAÇÃO] Etapa vira dado declarado, não código espalhado.** `RELATIONSHIP_CONFIG` já é injetado no motor — é o lugar natural.

Cada etapa declara: `chave` (imutável), `rótulo`, `canal` (mensagem/ligação/reunião), `execução` (`AUTOMATICA` só para E0 · `MANUAL` para o resto), `ancoragem` (a partir de qual evento conta o prazo), `deslocamento`, `condições de entrada`, `condições de saída` e **`status`: `ativa` ou `planejada`**.

Consequências práticas:
- **Etapa `planejada` existe e não opera:** aparece na configuração e na documentação, mas o planejador nunca cria ação para ela e o despachante a recusa. É exatamente isso que permite discutir E4–E8 sem que o sistema as trate como existentes.
- **Ativar uma etapa é mudar um campo**, não alterar o motor.
- **Nunca renomear chaves existentes.** E0, E1, E3, E4, E12, E30, V, RE e RF continuam com as chaves já gravadas em `executedSteps` e nos eventos. Renomear reescreveria o passado.
- **Novas etapas nascem com chaves novas e distintas** (prefixo de geração), mesmo quando o rótulo humano for parecido.
- **Cada cadência guarda a versão do vocabulário** com que nasceu: leads antigos terminam no vocabulário antigo, novos nascem no novo, sem conversão no meio do caminho.
- O mapa antigo→novo é decisão de vocês e vira **tabela de correspondência para relatório**, jamais migração de dados.

---

## 3. Estrutura da ação e do resultado

**Tabela de ações [FUTURO]** — chave única `lead_id + etapa + ciclo`:
`action_id`, `lead_id`, `etapa`, `ciclo`, `tipo` (ligação/mensagem/reunião/compromisso), `responsável`, `prevista_para`, `estado` (`PLANEJADA` · `EXECUTADA` · `PULADA` · `REAGENDADA` · `BLOQUEADA`), `resultado` (categórico), `justificativa`, `observação`, `origem` (referência à reunião ou tarefa que a originou), `versao_mensagem`, `executada_por`, `executada_em`, `acao_anterior`.

**Vocabulário fechado de resultado** — nenhuma regra lê texto livre:

| Tipo | Campos |
|---|---|
| Ligação | `atendeu` (sim/não), `tentativa` (n) |
| Reunião | `compareceu`, `evolucao` (só se compareceu), `reagendar` |
| Mensagem | `realizada` (sim/não) |
| Qualquer | `sem_contato` (bool), `observação` (texto livre, **nunca lido por regra**) |

**Pular** é **estado**, não resultado — é o que o separa de "executou e deu negativo": `estado = PULADA` + `justificativa` validada no servidor + `pulada_por` + `pulada_em` + `destino` (reagendada para data X, ou encerrada no ciclo). Nunca entra em `executedSteps`. Três categorias que jamais se somam: realizada, pulada, não respondida. "Não consegui contato" é execução (tentou); "estava em outra reunião" é pulo (não tentou).

**Eventos append-only:** cada resposta grava `action_id`, `lead_id`, usuário, timestamp e campos categóricos. Nada é sobrescrito.

**Reuniões:** a ação **referencia** `portal_meetings`, nunca copia — horário, nome e telefone continuam sendo lidos da reunião original. Uma reunião = no máximo uma ação aberta (chave única), o que elimina duplicidade por construção. Aparece em `início − janela` (a mecânica de `MEETING_FOCUS_WINDOW_MS` já existe; basta parametrizar de 15 para 5 min). Reagendar em **uma transação**: reunião original encerrada com resultado, nova reunião criada, nova ação apontando para a anterior; a ação antiga fica `REAGENDADA` para sempre.

**Identidade:** a interface envia **apenas** o `action_id`. O servidor deriva o `lead_id` da própria ação, confere `can_access_investor` e só então grava — `lead_id` vindo do cliente é ignorado. Chave estrangeira + RLS tornam nota órfã ou cruzada fisicamente impossível. Nome é exibição, nunca chave de busca em caminho de escrita.

**Não desaparece, não duplica, não é recriada:** fica `PLANEJADA` até haver resposta ("atrasada" é leitura de `prevista_para < agora`, como `resolveBucket` já faz); chave única no banco + caminho único de escrita; o planejador só cria etapa que ainda não tem ação naquele ciclo.

**Auditoria** responde por contagem, não por leitura de texto: ações do dia, realizadas, não realizadas, puladas, reagendadas, ligações tentadas, reuniões sem comparecimento, mensagens realizadas, justificativa de cada não realizada e em qual investidor — cada linha carregando `action_id` e `lead_id`.

---

## 4. Mensagens com versões completas — recomendação

**Sim, a simplificação é recomendável.** A montagem em tempo de execução é a fonte natural de divergência entre texto e link e impede reconstruir o que foi realmente enviado.

**Cada versão é um registro próprio:** etapa, número, rótulo (com nome / sem nome), texto completo, link completo, ativa/inativa.
- A ação aponta para o `id` da versão → o histórico é literal e imutável.
- Alterar texto **cria versão nova**; a antiga continua legível. Não existe edição retroativa de mensagem já usada.
- Ativar/desativar versão sem tocar nas outras; contagem de uso por versão fica trivial.
- Versões dentro de um único registro (JSON) reabririam o problema de montagem — não recomendo.

**Conversa com a cadência e a Ação do Dia:** o planejador escolhe a versão **no momento em que cria a ação** e grava `versao_mensagem` nela. A Ação do Dia exibe o texto pronto (com botão de copiar/abrir conversa) — o executivo vê exatamente o que será enviado, sem montagem no meio do caminho.

**Rotação:**

| | Aleatória | Determinística por lead | Sequência por lead |
|---|---|---|---|
| Reprodutibilidade | nenhuma | total | depende de contador |
| Retry | pode mudar de versão | sempre a mesma | pode avançar indevidamente |
| Auditoria | só se o sorteio for gravado | derivável do ID | exige ler o contador |
| Homologação | não reproduzível | reproduzível | parcial |

**Recomendação: determinística por lead**, e ainda assim gravar a versão escolhida na ação — assim nada precisa ser recalculado depois.

**Sem quebrar o histórico:** mensagens já enviadas continuam apontando para o par conteúdo+binding atual; as novas apontam para versões. O histórico lê os dois formatos. Nada é migrado à força.

---

## 5. Dependências e riscos ainda pouco considerados

1. **`remarketing-engine` roda a cada minuto e é um segundo executor real hoje** — não é detalhe de configuração; é decisão pendente antes de qualquer corte.
2. **`closure` (E27/Finalização) e `inbound` alcançam o canal fora do tick do motor** — não passam pela decisão e hoje só são contidos pela Safety Lock.
3. **Duas identidades de lead convivem** (`portal_leads.id` / `gs_<external_id>` x `crm_leads.id`) — `guard.server.ts` precisa traduzir entre elas, e `daily-actions` carrega `crmLeadId` separado em `CadenceRef`. A tabela de ações precisa decidir **qual identidade é canônica** e guardar a outra como referência; errar isso reproduz o bug de "lead real não encontrado" em escala.
4. **A fila de E0 adiada tem janela de 3 dias e limite de 200** — pendências fora disso somem silenciosamente. Medir antes de migrar.
5. **O resgate de cadências por `msg_e0_%` no tick** pode ressuscitar leads antigos durante a migração.
6. **A fila de ligações é recalculada a cada leitura** (`buildCadenceQueue`), enquanto a tabela de ações é persistente. Durante a transição as duas coexistem e podem discordar — por isso a fase de sombra.
7. **`crm_cadence_tasks` usa `onConflict` em `lead_id,channel,cycle_date,step_day`**; a ação nova usará `lead_id + etapa + ciclo`. As duas chaves precisam ser conciliadas ou a ação precisa guardar a `CadenceRef` inteira para conseguir concluir na origem.
8. **Reunião hoje pausa a cadência via `SCHEDULE_CREATED`**; no modelo futuro quem retoma é o resultado da reunião. Se o resultado não for gravado, o lead fica parado para sempre — precisa de visibilidade explícita.
9. **Confirmação humana de "executada" pode não corresponder ao mundo real.** É aceitável e auditável (quem, quando), mas deve ser explícito para a gestão.
10. **Relatório depende de vocabulário fechado desde o primeiro dia.** Se algum resultado nascer como texto livre "por enquanto", o relatório nasce inviável.
11. **Fuso e fechamento às 22:00** já são regra; a tabela de ações precisa nascer com `prevista_para` coerente com essa janela, senão a fila do dia diverge do que o executivo espera.
12. **Permissões por módulo** (`workspace_module_permissions`) e `can_access_investor` precisam cobrir a nova tabela desde a criação — RLS e GRANT no mesmo movimento.

---

## 6. Ordem recomendada de construção

| Fase | O que entra | O que ainda não muda | Como testar antes de liberar a próxima |
|---|---|---|---|
| **1. Sombra** | tabela de ações + eventos; planejador grava a partir das decisões do motor | nada apresentado, nada executado; sistema atual idêntico | comparar por uma semana completa (incluindo sábado): toda decisão do motor tem ação correspondente, sem sobra nem falta, e nenhuma ação sai de `PLANEJADA` |
| **2. Apresentação** | Ação do Dia lê a tabela; resultados estruturados; ligações legadas viram somente leitura | despacho automático segue só para E0 | homologação com leads `TEST-`: ação atrasada continua visível; responder muda estado; responder duas vezes não duplica; a etapa não reaparece no mesmo ciclo; colapso por lead intacto |
| **3. Corte** | whitelist obrigatória; `engine.ts` para de executar E1+; remarketing/closure/inbound resolvidos | — | **teste negativo**: acionar cada um dos oito caminhos e confirmar recusa **pela whitelist**, antes da Safety Lock. Se a recusa vier da trava, o teste falhou. E0 continua funcionando |
| **4. Consolidação** | pular com justificativa, reagendamento, relatório, notas por ID, biblioteca de versões | — | números do relatório batem com a contagem direta; pular não aparece como executado; reagendamento preserva a reunião original; nota com `action_id` de outro executivo é recusada pelo servidor |

Rollback em todas as fases: desligar o caminho novo e voltar ao anterior — nada antigo é removido.

Ordem interna que evita retrabalho: **tabela e eventos primeiro** (tudo depende deles) → **planejador** → **whitelist** (antes de qualquer apresentação executar algo) → **interface de resposta** → **relatório** → **versões de mensagem** (independente, pode andar em paralelo a partir da fase 2).

---

## 7. Relatório consolidado

**Existe hoje:** motor com decisão isolada e injeção de dependências; execução acoplada à decisão; Ação do Dia como leitura pura com precedência, colapso e buckets; fila de ligações recalculada com desfecho SIM/NÃO; `portal_meetings` sem resultado; conteúdo resolvido em tempo de execução; guardas por escopo; Safety Lock; oito caminhos até o canal; quatro crons.

**Será mantido:** `machine.ts` como única decisão; toda a lógica de precedência, colapso, buckets e fuso; `portal_meetings`; `can_access_investor` / `current_executive_id`; guardas de escopo; Safety Lock; histórico integral (nada apagado, nada renomeado).

**Será alterado:** `executedSteps` escrito no resultado; `engine.ts` executa só E0; `daily-actions` lê a tabela de ações em vez de agregar fontes; `crm_cadence_tasks` vira somente leitura; ponto único de saída passa a exigir motivo; `config` ganha `ativa`/`planejada` e versão de vocabulário; reuniões ganham resultado e reagendamento.

**Será criado:** planejador; tabela de ações; eventos de resultado append-only; whitelist de autorização; vocabulário fechado de resultado; estado `PULADA`; biblioteca de versões completas; relatório do dia; painel de resposta maior na Ação do Dia.

**Regras já decididas:** E0 é a única automação; E1+ é ação humana; identificar não é executar; ação atrasada nunca some nem executa sozinha; tudo amarrado por ID, nome é só exibição; Safety Lock permanece como última barreira; E2/E4–E8 são conceitos, não funcionalidades; sem dois motores; sem duplicidade.

**Ainda dependem de definição:**
1. mapa das etapas atuais para a jornada E0…E8;
2. `visualizacao`, `reentrada` e RF permanecem no vocabulário novo?
3. pular consome a etapa ou ela pode voltar?
4. após "não compareceu", a cadência retoma em qual etapa?
5. remarketing e campanhas: automáticos, manuais ou desligados?
6. `inbound` continua automático?
7. ação pendente expira após N dias úteis ou fica indefinidamente?
8. quantas tentativas de ligação por ciclo e com que rótulos?
9. quem pode pular: só o responsável ou também a gestão?
10. ações anteriores ao marco de corte entram na fila ou ficam só como histórico?
11. confirmação de "mensagem enviada" é sempre obrigatória?
12. qual identidade de lead é canônica na tabela de ações?
13. "sem interesse" encerra a cadência ou apenas suspende?

**Riscos e dependências:** seção 5 acima, na íntegra.

**Ordem de implantação:** seção 6 acima.

---

## Resumo em linguagem simples

Hoje o sistema pensa e age no mesmo instante: quando decide que é hora de falar com alguém, já tenta falar — e existem oito portas diferentes por onde uma mensagem poderia sair, todas contidas por um único cadeado geral.

O modelo desenhado separa três papéis: **quem pensa** (o motor, que continua sendo o único a decidir o próximo passo), **quem organiza** (uma lista de tarefas com dono, prazo e situação) e **quem faz** (o executivo, na Ação do Dia).

O sistema só age sozinho no primeiro contato. Todo o resto é trabalho humano: ele lembra, organiza e registra, mas não fala no lugar de ninguém — e isso deixa de depender de alguém lembrar da regra, porque as portas de saída passam a exigir uma autorização que só o primeiro contato e as ações humanas possuem.

Tarefas atrasadas não somem: ficam visíveis até alguém dizer o que aconteceu. O executivo responde em opções objetivas e, quando não conseguir realizar, pode pular explicando o motivo — registrado com autor, hora e destino, nunca confundido com "tentou e não deu certo".

Tudo é amarrado pelo código interno do investidor, nunca pelo nome. As mensagens deixam de ser montadas na hora: cada versão nasce completa, com texto e link juntos, e o que foi enviado nunca muda depois.

A construção seria em quatro passos, começando por um período em que o novo modelo apenas observa, sem mudar nada — e cada passo só é liberado depois de passar nos testes descritos acima.
