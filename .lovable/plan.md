# Documento-mestre de construção — Arquitetura futura de Cadência, Ação do Dia e Mensagens

Referência oficial para a próxima fase. **Nada foi implementado nesta rodada**: sem código, sem banco, sem cron, sem fila, sem interface, sem configuração. A Global WhatsApp Safety Lock permanece intacta e nenhuma mensagem real é enviada.

**[HOJE]** verificado no sistema · **[FUTURO]** apenas desenho, não existe · **[RECOMENDAÇÃO]** proposta técnica · **[RISCO]** conflito a vigiar.

Regra de leitura deste documento: se algo aparece nas seções 3, B ou F, **não existe hoje**. Isso inclui E2, E4, E5, E6, E7, E8, "pular", resultados estruturados, reagendamento, relatório do executivo e versões completas de mensagem.

---

## 1. O que existe hoje e deve ser preservado

| Peça | O que faz hoje | Por que preservar |
|---|---|---|
| `machine.ts` | decide a próxima etapa | é a inteligência da cadência e está isolada — continua sendo a **única** fonte de decisão |
| `productionEngine()` | monta o motor por injeção (repositório, despachante, relógio, config, `leadContext`) | é justamente essa arquitetura que permite evoluir sem reescrever o motor |
| `daily-actions.ts` | camada pura de leitura: chave determinística, precedência de fonte, colapso "um lead = uma ação visível", buckets, fuso America/Sao_Paulo vindo do servidor | regras de negócio já validadas; migram inteiras para o modelo novo |
| `MEETING_FOCUS_WINDOW_MS` | janela de antecedência (15 min) | mecânica pronta; no futuro apenas parametrizada |
| `portal_meetings` | reuniões (25 colunas) | passa a ser **referenciada** pela ação, nunca copiada |
| `guard.server.ts` | valida destinatário por escopo (`TEST-` em homologação; lead real com telefone em produção) e traduz as duas identidades de lead | trava viva e necessária |
| `execution-mode.server.ts` | decide simulação pelo ambiente, não por constante | princípio correto: o ambiente decide antes das credenciais |
| `can_access_investor`, `current_executive_id` | controle de acesso por ID | base da validação de notas e ações |
| `whatsapp.server.ts` | todos os módulos já passam por ele | vira o ponto único de saída contratual |
| Safety Lock | bloqueia envio real | permanece como **última** barreira |
| `journey.server.ts` | agregador cronológico do lead | passa a incluir eventos de ação |
| Histórico integral | eventos, `executedSteps`, `crm_cadence_tasks`, mensagens já enviadas | nada é apagado, renomeado ou migrado à força |

---

## 2. O que existe hoje e muda de responsabilidade

| Peça | Hoje | Futuro |
|---|---|---|
| `executedSteps` (`relationship_cadences`) | escrito **na decisão** | escrito **no resultado**. É a mudança-raiz: sem ela, todo o resto é cosmético |
| `engine.ts` | decide e executa na mesma passagem, todas as etapas | executa **apenas E0**; para E1+ entrega a decisão ao planejador |
| `daily-actions.ts` | agrega 4 fontes em memória | lê a **tabela de ações**; mantém precedência, colapso e buckets |
| `crm_cadence_tasks` / `buildCadenceQueue` | recalcula a fila de ligações a cada leitura e cria a obrigação | **somente leitura**: histórico e ancoragem, nunca cria ação |
| `whatsapp.server.ts` | recebe qualquer chamada | exige **motivo de autorização** em todo envio |
| `RELATIONSHIP_CONFIG` / `step-registry` | lista de etapas | ganha `status` (`ativa` / `planejada`), `execução` (`AUTOMATICA` só E0) e marca de versão de vocabulário |
| `portal_meetings` + `SCHEDULE_CREATED` | reunião pausa a cadência | o **resultado** da reunião é quem retoma |
| Conteúdo (`relationship_contents` + bindings) | resolve texto e link na execução | novas mensagens usam versões completas; o formato antigo continua legível no histórico |
| Fila de E0 adiada | janela de 3 dias, limite de 200 | precisa ser medida e tornada visível antes de qualquer migração |

---

## 3. O que ainda não existe e será criado

**3.1 Planejador** — camada fina entre decidir e executar. Único ponto de escrita de ação. Recebe a decisão do motor; se for E0, encaminha ao despachante; se for E1+, cria a ação.

**3.2 Tabela de ações** — chave única `lead_id + etapa + ciclo`. Campos: `action_id`, `lead_id`, `etapa`, `ciclo`, `tipo` (ligação · mensagem · reunião · compromisso), `responsável`, `prevista_para`, `estado` (`PLANEJADA` · `EXECUTADA` · `PULADA` · `REAGENDADA` · `BLOQUEADA`), `resultado`, `justificativa`, `observação`, `origem`, `versao_mensagem`, `executada_por`, `executada_em`, `acao_anterior`.

**3.3 Eventos de resultado (append-only)** — `action_id`, `lead_id`, usuário, timestamp, campos categóricos. Novo evento `ACTION_COMPLETED` é o gatilho para o motor decidir o próximo passo.

**3.4 Whitelist de autorização** — dentro do ponto único de saída. Motivos válidos: `E0_AUTOMATICA`, `RESPOSTA_HUMANA` (janela de 24 h), `ACAO_EXECUTADA_POR_HUMANO` (com `action_id` + usuário). Sem motivo válido: recusa + auditoria. Com motivo automático, qualquer chave fora de `E0`/`E0_V1` é recusada.

**3.5 Vocabulário fechado de resultado** — nenhuma regra lê texto livre:

| Tipo | Campos |
|---|---|
| Ligação | `atendeu` (sim/não), `tentativa` (n) |
| Reunião | `compareceu`, `evolucao` (só se compareceu), `reagendar` |
| Mensagem | `realizada` (sim/não) |
| Qualquer | `sem_contato` (bool), `observação` (texto livre, **nunca lido por regra**) |

**3.6 Estado `PULADA`** — com justificativa validada no servidor, autor, momento e destino. Nunca entra em `executedSteps`. Três categorias que jamais se somam: realizada, pulada, não respondida. "Não consegui contato" é execução (tentou); "estava em outra reunião" é pulo (não tentou).

**3.7 Reagendamento transacional** — reunião original encerrada com resultado, nova reunião criada, nova ação apontando para a anterior; a ação antiga fica `REAGENDADA` para sempre.

**3.8 Biblioteca de versões completas** — cada versão é um registro próprio: etapa, número, rótulo (com nome / sem nome), texto completo, link completo, ativa/inativa. Texto publicado é imutável; alterar cria versão nova.

**3.9 Relatório do dia do executivo** — leitura por categorias, com `action_id` e `lead_id` em cada linha.

**3.10 Painel de resposta da Ação do Dia** — área maior que o card atual, com abrir conversa, ficha completa em camada, notas anteriores e últimos eventos, sem sair da fila.

---

## 4. O que foi descartado ou não faz parte da nova arquitetura

- **Segundo motor de decisão** — descartado. O planejador transcreve, não decide.
- **Ação do Dia decidindo cadência** — descartado. Ela apresenta e coleta resultado.
- **Renomear etapas históricas** para encaixá-las na jornada futura — descartado; destruiria o histórico.
- **Montagem de mensagem+conteúdo+link em tempo de execução** para mensagens novas — substituída por versões completas.
- **Versões dentro de um único registro (JSON)** — descartado; reabriria o problema de montagem.
- **Rotação aleatória** — não recomendada; sem reprodutibilidade em retry e auditoria.
- **Regra baseada em texto livre** — descartada. Observação é para gente, nunca para máquina.
- **Busca de lead por nome em caminho de escrita** — descartada em qualquer hipótese.
- **`engine.ts` executando E1+** — deixa de executar (o código não é apagado; para de agir).
- **Automação de qualquer etapa além de E0** — fora do escopo; exigiria decisão e implementação próprias.
- **Remover ou enfraquecer a Safety Lock** — fora de qualquer cenário.

---

## 5. Decisões já tomadas (registradas sem reinterpretação)

1. E0 é a única etapa com execução automática.
2. Todas as etapas posteriores são ações do executivo pela Ação do Dia.
3. Identificar uma etapa não significa executá-la.
4. A arquitetura separa DECISÃO → PLANEJAMENTO → EXECUÇÃO → RESULTADO.
5. Não haverá dois motores concorrentes.
6. A Ação do Dia se torna fonte persistente e auditável das ações do executivo.
7. Toda ação é obrigatoriamente vinculada ao `lead_id`.
8. Notas e resultados nunca podem ser gravados no lead errado.
9. O executivo registra resultados objetivos, reagendamento, não contato e afins.
10. "Pular" passará a existir, sempre com justificativa obrigatória e registro para auditoria.
11. Reuniões, ligações e mensagens fazem parte de um mesmo conceito de ação.
12. A Safety Lock permanece como última barreira; nenhuma arquitetura pode contorná-la.
13. Nenhuma mensagem real é enviada durante a construção.
14. Qualquer automação além de E0 exige decisão e implementação específicas.
15. E4–E8 são conceito futuro, não funcionalidades implantadas.
16. A nomenclatura futura não destrói o histórico existente.
17. Mensagens do motor terão múltiplas versões completas (texto + personalização + link).
18. As versões poderão ser rotacionadas conforme regras a definir.

---

## A) Arquitetura futura em linguagem simples

Hoje o sistema pensa e age no mesmo instante: quando decide que é hora de falar com alguém, já tenta falar. E existem oito caminhos diferentes por onde uma mensagem poderia sair — todos contidos por um único cadeado geral.

O modelo futuro separa três papéis:
- **quem pensa** — o motor, que continua sendo o único a decidir o próximo passo de cada investidor;
- **quem organiza** — uma lista de tarefas onde cada passo vira uma tarefa com dono, prazo e situação;
- **quem faz** — o executivo, na Ação do Dia, que executa e diz o que aconteceu.

O sistema só age sozinho no primeiro contato. Todo o resto é trabalho humano: ele lembra, organiza e registra, mas não fala no lugar de ninguém — e isso deixa de depender de alguém lembrar da regra, porque as portas de saída passam a exigir uma autorização que só o primeiro contato e as ações humanas possuem.

Tarefas atrasadas não somem: ficam visíveis até alguém dizer o que aconteceu. O executivo responde em opções objetivas e, quando não conseguir realizar, pode pular explicando o motivo — registrado com autor, hora e destino, nunca confundido com "tentou e não deu certo".

Tudo é amarrado pelo código interno do investidor, nunca pelo nome. As mensagens deixam de ser montadas na hora: cada versão nasce completa, com texto e link juntos, e o que foi enviado nunca muda depois.

```text
MOTOR (decide)
   └─> PLANEJADOR (registra a ação)
         ├─ E0 ──> envio automático → guard → SAFETY LOCK → canal
         └─ E1+ ─> AÇÃO DO DIA (apresenta) ─> executivo responde
                        └─> RESULTADO (registro definitivo)
                                 ├─> MOTOR decide de novo
                                 ├─> Notas / ficha do investidor
                                 └─> Relatório da gestão
```

---

## B) Componentes, tabelas e fluxos a criar ou alterar

**Criar:** tabela de ações · tabela de eventos de resultado · tabela de versões de mensagem · módulo planejador · whitelist de autorização no ponto único de saída · painel de resposta da Ação do Dia · relatório do dia do executivo.

**Alterar:** `machine.ts` (só o ponto de entrega da decisão) · `engine.ts` (só E0) · `dispatch.server.ts` (exigir motivo) · `whatsapp.server.ts` (whitelist) · `daily-actions.ts` (ler a tabela) · `daily-actions.server.ts` (fonte única) · `cadence.server.ts` (somente leitura) · `config.ts` / `step-registry.ts` (`ativa`/`planejada` + versão de vocabulário) · fluxo de reunião (resultado + reagendamento) · `journey.server.ts` (incluir eventos de ação).

**Não esquecer no mesmo movimento:** GRANT + RLS de toda tabela nova, usando `can_access_investor` / `current_executive_id`; e definir qual identidade de lead é canônica (`portal_leads.id` / `gs_<external_id>` x `crm_leads.id`), guardando a outra como referência.

---

## C) Ordem mais segura de implantação

| Fase | Entra | Ainda não muda | Teste de liberação |
|---|---|---|---|
| **1. Sombra** | tabela de ações + eventos; planejador grava a partir das decisões do motor | nada apresentado, nada executado; sistema atual idêntico | uma semana completa (com sábado): toda decisão do motor tem ação correspondente, sem sobra nem falta; nenhuma ação sai de `PLANEJADA` |
| **2. Apresentação** | Ação do Dia lê a tabela; resultados estruturados; ligações legadas viram leitura | despacho automático só para E0 | homologação com leads `TEST-`: atrasada continua visível; responder muda estado; responder duas vezes não duplica; etapa não reaparece no ciclo; colapso por lead intacto |
| **3. Corte** | whitelist obrigatória; `engine.ts` para de executar E1+; remarketing / closure / inbound resolvidos | — | **teste negativo**: acionar cada um dos oito caminhos e confirmar recusa **pela whitelist**, antes da Safety Lock. Se a recusa vier da trava, o teste falhou. E0 segue funcionando |
| **4. Consolidação** | pular, reagendamento, relatório, notas por ID, versões de mensagem | — | números do relatório batem com contagem direta; pular não conta como executado; reagendamento preserva a reunião original; nota com `action_id` de outro executivo é recusada |

**Anti-avalanche:** só etapas com vencimento **a partir do marco de ativação** viram ação; o passado permanece histórico. Mais teto por ciclo e ordenação por vencimento.
**Anti-duplicidade:** chave única no banco + um único caminho de escrita (decisão imediata e ciclo periódico entram pela mesma função).
**Rollback:** em qualquer fase, desligar o caminho novo e voltar ao anterior — nada antigo foi removido.

---

## D) Pontos que dependem de decisão de vocês

1. Mapa das etapas atuais (E0, E1, E3, E4, E12, E30) para a jornada futura E0…E8.
2. `visualizacao`, `reentrada` e RF permanecem no vocabulário novo?
3. Pular consome a etapa ou ela pode voltar no mesmo ciclo?
4. Após "não compareceu", a cadência retoma em qual etapa?
5. Remarketing e campanhas: automáticos, manuais ou desligados?
6. Resposta automática (`inbound`) continua automática?
7. Ação pendente expira após N dias úteis ou fica indefinidamente?
8. Quantas tentativas de ligação por ciclo e com que rótulos?
9. Quem pode pular: só o responsável ou também a gestão?
10. Ações anteriores ao marco de corte entram na fila ou ficam só como histórico?
11. Confirmação de "mensagem enviada" é sempre obrigatória?
12. Qual identidade de lead é canônica na tabela de ações?
13. Regra de rotação das versões (recomendo determinística por lead).
14. "Sem interesse" encerra a cadência ou apenas suspende?

---

## E) O que recomendo NÃO mexer agora

- **Safety Lock** — nada a fazer nela; a whitelist nasce na frente, não no lugar.
- **`machine.ts`** — a lógica de decisão não deve ser tocada nesta fase; só o destino da decisão muda.
- **Histórico e `crm_cadence_tasks`** — nenhuma migração, nenhum backfill, nenhuma renomeação.
- **Mensagens já enviadas** — permanecem no formato antigo; o histórico lê os dois.
- **Google Workspace, backup, revista, portal público, importador** — fora do escopo, sem dependência.
- **Remarketing** — não mexer antes da decisão de negócio; mexer cedo cria retrabalho garantido.
- **Interface do CRM/WhatsApp do executivo** — continua como está; o uso manual não muda.
- **Ativar E2/E4–E8** — permanecem `planejada` até o mapa oficial existir.

---

## F) Checklist de construção (base para os comandos futuros)

**Etapa 1 — Fundação (sombra)**
- [ ] Definir a identidade canônica de lead da tabela de ações
- [ ] Criar tabela de ações com chave única `lead_id + etapa + ciclo` + GRANT + RLS
- [ ] Criar tabela de eventos de resultado (append-only) + GRANT + RLS
- [ ] Criar o planejador como único ponto de escrita de ação
- [ ] Ligar o planejador à saída da decisão do motor, sem apresentar nem executar
- [ ] Observar por uma semana completa e comparar decisões x ações

**Etapa 2 — Apresentação**
- [ ] Adicionar `status` (`ativa`/`planejada`), `execução` e versão de vocabulário na configuração de etapas
- [ ] Fazer `daily-actions` ler a tabela de ações, preservando precedência, colapso e buckets
- [ ] Implementar o vocabulário fechado de resultado por tipo
- [ ] Construir o painel de resposta (contexto, conversa, ficha, notas)
- [ ] Tornar `crm_cadence_tasks` somente leitura
- [ ] Parametrizar a janela de antecedência da reunião
- [ ] Validar em homologação com leads `TEST-`

**Etapa 3 — Corte**
- [ ] Implementar a whitelist de autorização no ponto único de saída
- [ ] Fazer `engine.ts` deixar de executar E1+
- [ ] Resolver remarketing, campanhas, closure e inbound conforme decisão de negócio
- [ ] Revisar o resgate por `msg_e0_%` e a fila de E0 adiada (3 dias / 200)
- [ ] Executar o teste negativo nos oito caminhos

**Etapa 4 — Consolidação**
- [ ] Implementar `PULADA` com justificativa, autor, momento e destino
- [ ] Implementar o reagendamento transacional de reunião
- [ ] Amarrar notas por `action_id` com derivação de `lead_id` no servidor
- [ ] Construir o relatório do dia do executivo
- [ ] Criar a biblioteca de versões completas e a rotação definida
- [ ] Incluir eventos de ação no agregador cronológico do lead

**Invariantes válidos em todas as etapas**
- [ ] Nenhuma mensagem real enviada
- [ ] Safety Lock intacta
- [ ] Nenhuma etapa histórica renomeada
- [ ] Nenhum caminho novo até o canal
- [ ] Toda escrita de ação passa pelo planejador
- [ ] Toda gravação deriva o `lead_id` do `action_id` no servidor
