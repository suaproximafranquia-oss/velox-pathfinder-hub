# Documento-base de arquitetura — Cadência, Motor, E0, Ação do Dia, Mensagens

Documento de referência para uma construção futura. **Nada foi implementado nesta fase**: sem código, sem banco, sem cron, sem fila, sem interface. A Global WhatsApp Safety Lock permanece intacta.

Convenção usada em todo o documento:
**[HOJE]** existe e foi verificado · **[FUTURO]** apenas desenho, não existe no sistema · **[RECOMENDAÇÃO]** proposta técnica · **[RISCO]** conflito a vigiar.

Nada marcado [FUTURO] está implantado — inclusive E2, E5, E6, E7, E8, "Pular", resultados estruturados, reagendamento, relatório e versões completas de mensagem.

---

## 0. Retrato do sistema atual (base factual)

**Agendadores ativos no banco (4):**

| Job | Frequência | Papel |
|---|---|---|
| `portal-crm-sync-automatico` | 1 min | sincroniza leads → E0 → tick do motor |
| `remarketing-engine` | 1 min | executor próprio, independente do motor |
| `portal-backup-automatico` | 1 h | backup |
| `portal-backup-processador` | 1 min | processa fila de backup |

**Módulos que alcançam o canal (`whatsapp.server.ts`) — oito caminhos:**
`relationship/dispatch`, `relationship/e0`, `relationship/closure` (E27/Finalização), `relationship/inbound` (resposta automática), `remarketing/engine`, `campaigns`, `crm/messaging`, `crm/automation`, além do webhook da Meta.

**Motor:** `machine.ts` decide e `engine.ts` executa **na mesma passagem**. `relationship_cadences` guarda o estado do lead e `executedSteps` é gravado **no momento da decisão**, não do resultado.

**Ação do Dia:** `daily-actions.ts` é camada de leitura. Agrega 4 fontes, aplica precedência (AGENDA > REUNIÃO > MENSAGEM > LIGAÇÃO), colapsa por lead ("um lead = uma ação visível"), usa chave determinística e buckets temporais em America/Sao_Paulo. Não persiste e não recebe resultado.

**Conteúdo:** `relationship_contents` + `relationship_step_content_bindings` resolvem texto e link **no momento da execução**.

**Reuniões:** `portal_meetings` (25 colunas) existe; `SCHEDULE_CREATED` pausa a cadência. Não há comparecimento, evolução, reagendamento nem não comparecimento registrados.

**Vocabulário de resultado:** praticamente só eventos `..._SENT`. Não existe categoria comparável entre canais.

**Etapas atuais:** E0, E1, E3, E4, E12, E30 e os fluxos `visualizacao` (V3/V4), `reentrada` (RE0–RE3) e RF. **Não correspondem** à jornada futura E0…E8.

---

## 1. O que já existe e pode ser reaproveitado

| Peça | Por que aproveitar | Como entra no modelo futuro |
|---|---|---|
| `machine.ts` (decisão) | é a inteligência da cadência e está isolada | permanece **a única fonte de decisão**; não é reescrita |
| chave determinística de `daily-actions.ts` | já evita duplicidade em memória | vira a **chave única no banco** (`lead_id + etapa + ciclo`) |
| precedência e colapso por lead | regra de negócio já validada | permanece, operando sobre a tabela de ações |
| `resolveBucket` / fuso America/Sao_Paulo | tratamento de tempo correto | permanece — "atrasada" continua sendo leitura de tempo |
| janela de antecedência (hoje 15 min) | mecânica pronta | apenas parametrizada (5 min para reunião) |
| `portal_meetings` | tabela completa | passa a ser **referenciada** pela ação, nunca copiada |
| `can_access_investor`, `current_executive_id` | controle de acesso por ID já em produção | usados na validação servidor das ações e notas |
| `whatsapp.server.ts` | todos os módulos já passam por ele | vira o **ponto único de saída** contratual |
| Safety Lock | funciona | permanece como **última** barreira |
| `journey.server.ts` | agregador cronológico | passa a incluir eventos de ação |

---

## 2. O que precisa ser alterado

1. **`executedSteps` passa a ser escrito no resultado, nunca no planejamento.** Hoje é gravado na decisão — é o que faz o motor "achar" que executou. Essa é a mudança mais importante do documento inteiro.
2. **`engine.ts` deixa de executar E1+.** Continua executando apenas E0. Para o resto, entrega a decisão ao planejador.
3. **`daily-actions.ts` deixa de agregar fontes e passa a ler a tabela de ações.** A lógica interna (precedência, colapso, buckets) é preservada.
4. **`crm_cadence_tasks` vira somente leitura**: histórico e ancoragem, nunca criador de ação.
5. **`whatsapp.server.ts` passa a exigir motivo de autorização** em todo envio.
6. **`config.ts` / `step-registry.ts`** ganham o conceito de etapa `ativa` x `planejada` e a marca de versão de vocabulário.
7. **Reuniões** ganham resultado estruturado e reagendamento transacional.

---

## 3. O que precisa ser criado do zero

**3.1 Planejador** — camada fina entre decidir e executar. É o **único** ponto de escrita de ação. Recebe a decisão do motor; se for E0, encaminha ao despachante; se for E1+, cria a ação.

**3.2 Tabela de ações** — a peça central. Campos:
`action_id`, `lead_id`, `etapa`, `ciclo`, `tipo` (ligação / mensagem / reunião / agenda), `responsável`, `prevista_para`, `estado` (`PLANEJADA` · `EXECUTADA` · `PULADA` · `REAGENDADA` · `BLOQUEADA`), `resultado` (categórico), `justificativa`, `observação`, `origem` (referência à reunião ou à tarefa que a originou), `versao_mensagem`, `executada_por`, `executada_em`, `ação_anterior` (para reagendamento).
Chave única: `lead_id + etapa + ciclo`.

**3.3 Eventos de resultado (append-only)** — `action_id`, `lead_id`, usuário, timestamp, campos categóricos. Nada é sobrescrito. Novo evento `ACTION_COMPLETED` é o gatilho para o motor decidir o próximo passo.

**3.4 Whitelist de autorização** — dentro do ponto único de saída. Motivos válidos: `E0_AUTOMATICA`, `RESPOSTA_HUMANA` (janela de 24h), `ACAO_EXECUTADA_POR_HUMANO` (com `action_id` + usuário). Sem motivo válido: recusa + auditoria.

**3.5 Vocabulário fechado de resultado**

| Tipo | Campos |
|---|---|
| Ligação | `atendeu` (sim/não), `tentativa` (n) |
| Reunião | `compareceu`, `evolucao` (só se compareceu), `reagendar` |
| Mensagem | `realizada` (sim/não) |
| Qualquer | `sem_contato` (bool), `observação` (texto livre, **nunca lido por regra**) |

**3.6 Estado PULADA** — com `justificativa` validada no servidor, `pulada_por`, `pulada_em`, `destino`. Nunca entra em `executedSteps`. Três categorias que jamais se somam: realizada, pulada, não respondida.

**3.7 Biblioteca de versões completas** — cada versão é um registro próprio: etapa, número, rótulo (com nome / sem nome), texto completo, link completo, ativa/inativa. Texto publicado é imutável; alterar cria versão nova.

**3.8 Relatório do dia do executivo** — leitura por categorias, nunca por texto.

**3.9 Painel de resposta da Ação do Dia** — área maior que o card atual, com abrir conversa, ficha completa em camada, notas anteriores e últimos eventos, sem sair da fila.

---

## 4. O que deve ser descontinuado ou deixar de executar

| Item | Destino | Observação |
|---|---|---|
| `engine.ts` executando E1+ | **desligar** | mantém apenas E0 |
| `remarketing-engine` (cron 1 min) | **decisão de negócio** | hoje é um segundo executor real |
| `campaigns` automático | decisão de negócio | reclassificar ou desligar |
| `closure` (E27/Finalização) | exigir motivo explícito | hoje alcança o canal fora do tick |
| `inbound` (resposta automática) | decisão de negócio | continua automática? |
| `crm_cadence_tasks` como criador de ação | somente leitura | histórico preservado |
| montagem mensagem+conteúdo+link em execução | substituída por versões | o formato antigo continua legível no histórico |
| resgate de cadências por `msg_e0_%` no tick | revisar antes da fase 2 | pode ressuscitar leads antigos |

Nada é apagado. Descontinuar aqui significa **deixar de executar**, não remover histórico.

---

## 5. Como as partes se comunicam

```text
MOTOR (machine.ts — única decisão)
   │
   └─> PLANEJADOR (única escrita de ação; chave lead_id + etapa + ciclo)
         │
         ├─ E0 ──> DESPACHANTE (motivo E0_AUTOMATICA)
         │            └─> whitelist → ambiente → SAFETY LOCK → canal
         │
         └─ E1+ ─> TABELA DE AÇÕES ─> AÇÃO DO DIA (apresenta, não decide)
                        │
                        └─> executivo responde
                               └─> EVENTO DE RESULTADO (append-only)
                                        ├─> MOTOR decide de novo
                                        ├─> Workspace / Notas (leitura por ID)
                                        └─> Relatório (leitura por categorias)
```

Regras de comunicação, todas verificáveis:
- a Ação do Dia **nunca** decide etapa;
- o planejador **nunca** decide etapa;
- o motor **nunca** escreve ação diretamente;
- a interface envia **apenas** o `action_id`; o servidor deriva o `lead_id` da ação, confere `can_access_investor` e só então grava. `lead_id` vindo do cliente é ignorado;
- nome é campo de exibição, jamais chave de busca em caminho de escrita.

---

## 6. Onde estão os maiores riscos

**Duplicidade**
- dois caminhos de escrita (decisão imediata e ciclo periódico) — mitigação: função única + chave única no banco;
- reunião gerando mais de uma ação — mitigação: uma reunião = no máximo uma ação aberta;
- planejador e `engine.ts` ativos ao mesmo tempo — mitigação: fase de sombra.

**Execução indevida**
- oito caminhos alcançam o canal hoje; a whitelist precisa estar pronta **antes** de a Safety Lock ser eventualmente liberada;
- `remarketing-engine` a cada minuto é hoje um executor paralelo real;
- um módulo novo importar o cliente HTTP diretamente e contornar o ponto único.

**Perda de histórico**
- renomear etapas antigas para "encaixar" no vocabulário novo — proibido;
- editar texto de mensagem já enviada — impedido pela imutabilidade da versão;
- sobrescrever resultado — impedido pelo append-only.

**Avalanche na virada**
- só etapas com vencimento **a partir do marco de ativação** viram ação; o passado permanece histórico. Mais teto por ciclo e ordenação por vencimento.

**Silêncio operacional**
- a fila de E0 adiada tem janela de 3 dias e limite de 200 — pendências fora disso desaparecem sem aviso. Vale medir antes.

---

## 7. Ordem ideal de implantação

| Fase | O que entra | O que ainda não muda |
|---|---|---|
| **1. Sombra** | planejador grava ações; tabela e eventos criados | nada é apresentado nem executado; sistema atual idêntico |
| **2. Apresentação** | Ação do Dia lê a tabela; resultados estruturados; ligações legadas viram leitura | despacho automático segue só para E0 |
| **3. Corte** | whitelist obrigatória; `engine.ts` para de executar E1+; remarketing/closure/inbound resolvidos | — |
| **4. Consolidação** | pular com justificativa, reagendamento, relatório, notas por ID, biblioteca de versões | — |

Etapas futuras (E2, E5–E8) permanecem declaradas como `planejada` durante todas as fases: visíveis na configuração, nunca criando ação nem sendo despachadas. É o que permite discuti-las sem que o sistema as trate como existentes.

---

## 8. Como testar cada fase antes de liberar a próxima

**Fase 1 (Sombra)** — o teste é comparativo: durante N dias, conferir que o conjunto de ações criadas pelo planejador equivale às decisões que o motor tomou, sem sobras nem faltas. Verificar que nenhuma ação tem `estado` diferente de `PLANEJADA` e que nenhum envio ocorreu por causa dela. Critério de saída: divergência zero em uma semana completa, incluindo sábado.

**Fase 2 (Apresentação)** — usar o ambiente de homologação já existente, com leads fictícios `TEST-XXXX`, nunca dados reais. Conferir: ação atrasada continua visível; responder muda estado; responder duas vezes não duplica; a mesma etapa não reaparece no mesmo ciclo; o colapso por lead continua correto. Critério de saída: nenhuma ação órfã e nenhum estado inconsistente.

**Fase 3 (Corte)** — teste negativo, o mais importante: tentar disparar cada um dos oito caminhos e confirmar que **todos** são recusados pela whitelist antes de chegar à Safety Lock. O teste só passa se a recusa acontecer por falta de autorização, não por causa da trava. Conferir também que E0 continua funcionando.

**Fase 4 (Consolidação)** — conferir que os números do relatório batem com a contagem direta da tabela, que pular não aparece como executado, que o reagendamento preserva a reunião original, e que uma nota gravada com `action_id` de outro executivo é recusada pelo servidor.

**Em todas as fases:** rollback previsto é desligar o novo caminho e voltar ao anterior, já que nada antigo foi removido.

---

## 9. Decisões de negócio pendentes antes da construção

1. Mapa oficial das etapas atuais (E0, E1, E3, E4, E12, E30) para a jornada futura E0…E8.
2. Os fluxos `visualizacao`, `reentrada` e RF permanecem no vocabulário novo?
3. Pular consome a etapa ou ela pode voltar no mesmo ciclo?
4. Após "não compareceu", a cadência retoma em qual etapa?
5. Remarketing e campanhas: automáticos, manuais ou desligados?
6. Resposta automática (`inbound`) continua automática?
7. Ação pendente expira após N dias úteis ou fica indefinidamente?
8. Quantas tentativas de ligação por ciclo e com que rótulos ("2ª tentativa")?
9. Quem pode pular: só o responsável ou também a gestão?
10. Ações anteriores ao marco de corte entram na Ação do Dia ou ficam só como histórico?
11. Confirmação de "mensagem enviada" é sempre obrigatória, ou copiar basta em algum caso?
12. Rotação de versões: por lead (recomendado), por executivo ou sequência global?
13. "Sem interesse" encerra a cadência ou apenas suspende?

---

## 10. Registros indispensáveis para retomar daqui a semanas

Estes são os pontos que, se esquecidos, obrigariam a refazer todo o raciocínio:

1. **`executedSteps` hoje é escrito na decisão, não no resultado.** É a raiz do acoplamento entre decidir e executar. Qualquer construção começa por aí.
2. **Existem oito caminhos até o canal**, listados na seção 0. A Safety Lock é hoje a única coisa que os contém.
3. **`remarketing-engine` roda a cada minuto e é um segundo executor real** — não é um detalhe de configuração, é uma decisão pendente.
4. **A chave `lead_id + etapa + ciclo`** é o que impede duplicidade; ela já existe em memória em `daily-actions.ts` e precisa migrar para o banco.
5. **A whitelist precisa existir antes de a Safety Lock ser liberada**, nunca depois.
6. **Não renomear etapas históricas.** Vocabulário versionado por cadência; leads antigos terminam no vocabulário antigo.
7. **Etapa `planejada` x `ativa`** é o mecanismo que permite E2/E5–E8 existirem no desenho sem existirem na operação.
8. **Rotação determinística por lead + gravar a versão escolhida na ação** — assim o histórico é literal e não depende de recalcular.
9. **A interface só envia `action_id`.** O servidor deriva o `lead_id`. Essa é a regra que impede nota no investidor errado.
10. **Observação é texto para gente, nunca para regra.** Toda decisão do motor lê apenas campos categóricos.
11. **A fila de E0 adiada tem janela de 3 dias e limite de 200** — medir antes de qualquer migração.
12. **A ordem de verificação futura do envio** é: motivo válido → etapa permitida → destinatário permitido → Safety Lock → canal. Cada camada recusa sozinha.

---

## Resumo em linguagem simples

Hoje o sistema pensa e age no mesmo instante: quando decide que é hora de falar com alguém, ele já tenta falar — e há oito portas diferentes por onde uma mensagem poderia sair, todas contidas por um único cadeado geral.

O modelo desenhado separa três papéis: **quem pensa** (o motor, que continua sendo o único a decidir o próximo passo), **quem organiza** (uma lista de tarefas com dono, prazo e situação) e **quem faz** (o executivo, na Ação do Dia).

O sistema só age sozinho no primeiro contato. Todo o resto é trabalho humano: ele lembra, organiza e registra, mas não fala no lugar de ninguém — e isso não depende de alguém lembrar da regra, porque as portas de saída passam a exigir uma autorização que só o primeiro contato e as ações humanas possuem.

Tarefas atrasadas não somem: ficam visíveis até alguém dizer o que aconteceu. O executivo responde em opções objetivas e, quando não conseguir realizar, pode pular explicando o motivo — registrado com autor, hora e destino, e nunca confundido com "tentou e não deu certo".

Tudo é amarrado pelo código interno do investidor, nunca pelo nome. As mensagens deixam de ser montadas na hora: cada versão nasce completa, com texto e link juntos, e o que foi enviado nunca muda depois.

A construção seria em quatro passos, começando por um período em que o novo modelo apenas observa, sem mudar nada — e cada passo só é liberado depois de passar nos testes descritos acima.
