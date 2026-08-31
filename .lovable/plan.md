# Diagnóstico integrado — Cadência, Ação do Dia, Agendamentos, Mensagens e Auditoria

Somente análise. Nada foi alterado: sem código, sem banco, sem tabela, sem cron, sem interface, sem envio. A Global WhatsApp Safety Lock permanece exatamente como está.

---

## 1. Confirmação de segurança — houve envio real pela Meta?

**Não. Nenhuma mensagem real foi aceita ou entregue pela API oficial da Meta desde a criação do projeto.**

Evidências verificadas agora, em conjunto:

1. **Credenciais inexistentes.** `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` nunca foram cadastrados no projeto. Sem eles nenhuma chamada à Graph API pode sequer ser autenticada.
2. **Nenhum identificador da Meta no banco.** A tabela de envios tem 24 registros: 9 marcados como simulados e 15 como não simulados. Nos 15 "não simulados", o campo de identificador da mensagem contém apenas chaves **internas** no formato `msg_e0_gs_58827` — nunca um `wamid.` , que é o formato que a Meta devolve quando aceita uma mensagem. Nenhum registro tem nome de template oficial preenchido.
3. **Log do motor.** 524 ocorrências de `e0_bloqueada` e 19 de `etapa_simulada`; nenhum registro de entrega confirmada.
4. **O lote das 13:51 UTC de 31/08** (leads `gs_58744` a `gs_58827`, 12 mensagens E0) — que gerou a dúvida — está exatamente nesse grupo: registro criado no Portal, sem identificador da Meta, sem template. Foi represamento de fila, não entrega.

Classificando conforme sua distinção:

| Categoria | Ocorreu? |
|---|---|
| Mensagem criada/registrada no Portal | Sim — 24 registros |
| Mensagem simulada | Sim — 9 |
| Mensagem bloqueada | Sim — 524 bloqueios de E0 registrados |
| Mensagem aguardando entrega externa | Sim — os 15 "não simulados" estão nesse estado |
| Tentativa de envio à Graph API | Não há evidência de chamada bem-sucedida; sem credencial, não se completa |
| Mensagem aceita pela Graph API | **Não** — nenhum `wamid` existe no banco |
| Mensagem entregue ao WhatsApp | **Não** |

Ressalva honesta: a ausência de `wamid` e de credencial é prova forte e consistente, mas é prova **pelo lado do sistema**. A confirmação definitiva pelo lado da Meta só existiria com acesso ao histórico da conta no provedor, que não temos. Nada nos registros locais contradiz a conclusão.

---

## 2. Como o sistema funciona hoje

### Fluxo real

```text
LEAD ENTRA (GreenSales / Portal)
 → runLeadSync (cron 1 min)              [automático]
 → crm_leads + crm_lead_events
 → registerFirstContact (E0)             [automático]
     └ fora da janela → deferFirstContact → fila de adiadas
 → runRelationshipTick                   [automático]
 → decide.ts calcula a próxima etapa (em memória)
 → relationship_queue: PENDING → claim → EXECUTED/FAILED
 → dispatcher → whatsapp.server → SAFETY LOCK → (bloqueado)
 → relationship_engine_log + crm_messages + relationship_message_sends
```

### O que é automático hoje

Entrada e sincronização de leads; E0; **E1, E3, E4, E12 em diante** (o motor executa, não apenas decide); reengajamento R1–R3; reentrada RE0–RE3; remarketing (cron próprio); resposta automática a mensagem recebida; reconciliação diária; backup.

Observação de nomenclatura: a sequência real hoje é `E0 → E1 → E3 → E4 → E12 → E30`, com variantes `V3/V4`, `R1–R3`, `RE0–RE3`, `RF0/RF1`. Não existem E2 e E5–E8. A premissa "só E0 é automática" se aplica igualmente a todas as etapas posteriores, com qualquer nome.

### O que é manual hoje

Ligações (a fila é calculada, a execução e o desfecho são humanos); mensagem avulsa pelo CRM; criação e condução de reuniões; notas na ficha do investidor; movimentação de coluna.

### Onde cada informação vive

| Informação | Local |
|---|---|
| Etapas da cadência | **Constantes de código** (`STEPS`), não no banco |
| Fila de mensagens | `relationship_queue` |
| Mensagem enviada | `crm_messages` + `relationship_message_sends` (snapshot congelado) |
| Ligações | `crm_cadence_tasks` (por dia, não por horário) |
| Reuniões | `portal_meetings` |
| Compromissos livres | `workspace_agenda_events` |
| Eventos do lead | `crm_lead_events` |
| Decisões do motor | `relationship_engine_log` |
| Identidade do investidor | `portal_leads.id` (canônica) e `crm_leads.id` |

### Quem decide, quem executa, quem pode gerar saída

- **Decide**: `decide.ts` / `machine.ts` — puro, determinístico, sem rede.
- **Executa**: `engine.ts`, no **mesmo ciclo** da decisão. É aqui que está o problema central.
- **Podem gerar saída**: motor (tick), E0 (`e0.server.ts`), remarketing, resposta automática, envio manual pelo CRM. Todos convergem em `whatsapp.server.ts` — a convergência existe só na camada de rede, não na de decisão.

### Simultaneidade e risco

- Cron de sincronização, cron de remarketing e cron de backup rodam a cada minuto, independentes.
- A trava antiabandono de 15 minutos no run de sincronização, combinada com processamento em lote, foi exatamente o que produziu o disparo represado das 13:51.
- **Riscos concretos**: (a) o mesmo lead alcançável por dois caminhos (E0 pela fila e pelo tick); (b) remarketing sem qualquer relação com o motor; (c) uma etapa vencida vira envio sem intervenção humana; (d) ação atrasada some da fila de ligações quando o ciclo muda.

---

## 3. Conflitos entre a premissa desejada e o código atual

| Premissa desejada | Conflito hoje |
|---|---|
| Só E0 é automática | O tick executa qualquer etapa vencida |
| Decidir ≠ executar | São o mesmo evento dentro de `engine.ts` |
| Ação atrasada não some | Ligações são calculadas por dia; mudou o ciclo, some |
| Pulo com justificativa | Não existe conceito de pulo |
| Mensagem pronta com link | Hoje monta-se em tempo de envio, com busca em outro módulo |
| Tudo por ID | Já é a regra na maior parte, mas notas e observações não têm vínculo formal com a ação que as originou |

Nenhum desses conflitos foi alterado. Todos são resolvíveis sem reconstruir o sistema.

---

## 4. Como transformar o modelo com segurança

**Reaproveitar sem mudanças**: motor de decisão, E0 e seu caminho próprio, Safety Lock, permissões (`has_role`, `can_access_investor`, `current_executive_id`), identidade do lead, todo o histórico.

**Mudar de responsabilidade**: `engine.ts` deixa de executar e passa a registrar a ação prevista; `relationship_queue` deixa de ser gatilho; `crm_cadence_tasks` vira histórico; `buildDailyActions` deixa de agregar quatro fontes e passa a ler uma.

**Onde é perigoso "desligar"**: desligar o tick por inteiro derruba também a E0 e a recuperação de cadências órfãs — a E0 depende do mesmo ciclo. O correto é **filtrar por etapa dentro do tick**, não desligar o tick.

**Como impedir E1+ automático (duas barreiras independentes)**:
1. No executor: uma lista server-side de etapas com automação de saída, contendo hoje apenas `E0` e `E0_V1`. Fora dela, a etapa vira ação pendente e nunca chega ao dispatcher.
2. No ponto de saída: o dispatcher recusa etapa fora da lista, do mesmo modo que a Safety Lock recusa por data. Um job novo escrito por engano no futuro ainda esbarra aqui.

**Como impedir automação acidental futura**: a lista é o único lugar onde uma etapa pode ganhar automação; toda tentativa fora dela é registrada com motivo legível; e a alteração da lista é uma mudança de código deliberada, nunca uma configuração de tela.

---

## 5. Decisão → Planejamento → Execução

**A separação é adequada** e é a mudança de maior valor: hoje "chegou a hora" e "envie" são o mesmo evento.

**Adaptar `relationship_queue` ou criar estrutura própria?** Recomendação: **estrutura específica de ações**. A queue atual representa só mensagem do motor; a ação precisa representar ligação, mensagem, reunião e tarefa, com responsável, prazo, justificativa e resultado. Forçar isso na tabela existente mistura dois significados e torna a migração irreversível. A queue permanece legível como histórico.

- **Dois motores ao mesmo tempo**: evitados porque só existe um decisor. O que se cria é uma tabela de plano, não um segundo cérebro.
- **Duplicidade**: chave determinística — lead + etapa + ciclo — com unicidade **no banco**. Idempotência não pode depender de quem chama.
- **Ação atrasada não some**: "atrasada" não é estado persistido, é leitura de `prazo < agora` sobre uma ação pendente. Nenhum processo muda estado por passagem de tempo.
- **Pulada / reagendada**: transições explícitas, com autor, instante e justificativa; reagendar encerra a ação como "reagendada" e cria a nova na mesma transação.
- **Histórico completo**: eventos imutáveis; o estado atual é a soma deles.
- **ID correto**: `lead_id` obrigatório com chave estrangeira, derivado sempre da ação.

---

## 6. Regra master de identidade

Estrutural, em três camadas:

1. **Banco**: `lead_id` NOT NULL com chave estrangeira em ação, evento, nota, resultado e agendamento. Sem ID, a linha não existe.
2. **Servidor**: a interface envia o **identificador da ação**; o servidor deriva o lead a partir dela. O cliente nunca informa "em qual lead salvar".
3. **Regra fechada**: nome é campo de exibição. Nenhuma escrita, busca de destino ou decisão pode usar nome. Vale igualmente para a central da gestora — nenhuma rota administrativa tem atalho de gravação próprio.

Com isso, salvar nota no investidor errado deixa de ser possível por seleção de tela, contexto perdido ou homônimo.

---

## 7. Ação do Dia — estrutura

- **Visibilidade**: calculada na leitura. Com horário, aparece a partir de `horário − 5 min`; sem horário, no dia devido. Passado o horário, a condição continua verdadeira — a ação **não pode** sumir.
- **Atrasada × pulada**: atrasada é leitura de tempo sobre ação pendente; pulada é estado com autor e motivo.
- **Pulo sem execução retroativa**: pular encerra a ação e **não** dispara nada; a próxima etapa continua sendo decisão do motor.
- **Justificativa obrigatória**: obrigatória no banco, não só na tela — senão um caminho futuro grava sem ela.
- **Sem brecha de duplicidade**: pular é transição da ação existente, nunca criação de nova linha.

---

## 8. Resultado de ligação

- "Atendeu? NÃO" = ação **executada**, resultado negativo, sem observação exigida.
- "Atendeu? SIM" = ação executada, resultado positivo, observação opcional.
- Armazenamento: evento da ação, não card novo. A observação é campo do mesmo evento e só vira nota visível quando tem texto.
- Visualmente, "não atendeu" e "não realizada" precisam ser rótulos diferentes em qualquer tela — são categorias distintas por construção.

---

## 9. Resultado de reunião

Estrutura: a ação de reunião referencia o agendamento (`portal_meetings`); o resultado é evento; o reagendamento é **nova ação** com referência à anterior. A reunião original nunca é reescrita.

Eventos independentes: compareceu, houve evolução, deseja reagendar. **"Houve evolução" não é interpretado pelo sistema** — não muda etapa, não move o lead, não dispara nada. Fica registrado como o executivo respondeu.

Retorno ao fluxo R quando não comparece: quem calcula é o motor, a partir dos eventos. Ele já recusa etapa fora de ordem e etapa repetida, então "se já está em R, avança" é comportamento natural da máquina, não regra nova. Pular R3 quando o material correspondente já foi entregue é uma **decisão de negócio a confirmar** — o motor precisará de um critério explícito de "material já entregue", que hoje não existe como conceito.

---

## 10. Mensagens — versões completas

**Sim, é tecnicamente mais simples e mais segura.** Hoje a mensagem se monta no instante do envio a partir de vínculo etapa↔conteúdo, rotação e busca na Biblioteca — cada passo é um ponto de falha, e é a origem dos bloqueios "sem vínculo". Guardar texto e link juntos elimina a montagem: se a versão existe, a mensagem existe.

- **Armazenar a mensagem completa com o link não traz problema**, desde que o histórico guarde a **cópia do que foi usado**, não uma referência à versão. Isso o sistema já faz hoje com o snapshot congelado — o mesmo princípio se aplica.
- **Rotação**: recomendo **sequencial determinística** (previsível, testável, distribui igualmente) com a regra configurável por etapa. Aleatório dificulta auditoria e pode repetir a mesma versão para o mesmo lead.
- **Alteração futura não altera histórico**: versões são **imutáveis**; editar cria uma nova versão e desativa a anterior. A ação antiga continua apontando para o texto exato que foi usado.
- **Com a Ação do Dia**: a ação de mensagem chega ao executivo já com texto e link resolvidos, para revisar e enviar. Ele vê o que vai mandar — que é o ganho central do modelo manual.

---

## 11. GreenSales

Recomendação: **uma fonte de verdade, uma direção de cópia**. O Portal é dono das ações, notas e histórico. Quando o executivo registrar uma evolução relevante, a informação é **copiada** para o GreenSales como texto, marcada como espelho, com registro de que a cópia ocorreu. Nunca o contrário: o GreenSales não devolve nota para o Portal. Assim não há dois donos do mesmo dado e a inconsistência fica impossível por construção — no máximo existe atraso na cópia, que é visível e reprocessável.

---

## 12. Notes do Executivo

Estrutura recomendada, três papéis sem sobreposição:

- **Ação** — estado atual (o que deve ser feito).
- **Eventos da ação** — histórico imutável (o que aconteceu).
- **Notas** — texto visível no Workspace, cada uma com o `lead_id` e a referência da ação que a originou.

Notas são acrescentadas, nunca sobrescritas. Abrir o card do investidor mostra todas as notas daquele ID, independentemente de onde o lead esteja (GreenSales, Portal, redistribuição, central da gestora).

---

## 13. Relatório administrativo

- **Estrutura**: se cada ação é uma linha com tipo, executivo, estado, resultado e prazo, o relatório é contagem direta — nunca leitura de texto.
- **Números auditáveis**: cada número aponta para as linhas que o compõem; clicar no número lista as ações.
- **Sem contagem dupla**: a chave determinística garante uma linha por ação.
- **Categorias distintas**: planejada, executada com resultado positivo (verde), executada com resultado negativo (vermelho), reagendada, pulada (categoria própria — nunca junto de negativo). "Ligação feita, não atendeu" é execução com resultado negativo, não falha do executivo.
- **Filtro por executivo e visão total da gestora**: já suportado pelo modelo de papéis atual.
- **Abrir o lead sem perder contexto**: camada sobre a tela (tela sobre tela), navegando por `lead_id`, com o relatório preservado por baixo. Nada de navegação que troque a página.

---

## 14. Agendamento — separar os horários

Recomendo tratar como **cinco instantes distintos**, todos registrados:

1. horário do compromisso;
2. horário em que a ação passou a aparecer (compromisso − 5 min);
3. horário em que foi executada;
4. horário em que o resultado foi respondido;
5. horário do reagendamento ou do pulo.

Hoje esses instantes estão colapsados em um ou dois campos, e é por isso que não se consegue responder "apareceu quando?" ou "respondeu quando?".

---

## 15. Observação e limite de caracteres

- **Limite de preview recomendado: 140 caracteres**, com reticências. É o suficiente para reconhecer o conteúdo sem quebrar o alinhamento da lista.
- **Armazenamento**: texto completo sempre, sem truncar no banco. O corte é exclusivamente de exibição.
- **Usabilidade**: clique abre a observação completa em camada sobre a tela; fechar devolve exatamente à posição anterior, sem recarregar nem voltar ao início.

---

## 16. Caminhos possíveis

**Caminho A — adaptar o que já existe** (estender `relationship_queue`, acrescentar campos).
Vantagens: menos estruturas novas, migração aparentemente curta.
Desvantagens: a tabela passa a significar duas coisas; ligações e reuniões não cabem sem distorção; o significado de `PENDING` fica ambíguo entre "previsto" e "pronto para disparar".
Riscos: alto risco de envio indevido — a mesma linha que representa plano continua sendo lida por código que dispara.
Complexidade: baixa no início, alta depois.

**Caminho B — nova camada de planejamento/ações**, com o motor intacto.
Vantagens: significados separados; ligação, mensagem, reunião e tarefa no mesmo modelo; auditoria e relatório saem naturalmente; transição em sombra é possível.
Desvantagens: duas estruturas novas e um período de convivência.
Riscos: duplicidade durante a convivência — mitigada porque só um caminho executa por vez.
Impacto: motor, E0, Safety Lock e histórico permanecem.

**Caminho C — reescrever o motor como serviço de agenda completo.**
Vantagens: modelo teoricamente mais limpo.
Desvantagens: joga fora regras de calendário, janela operacional, ordem de fluxo e travas já validadas em produção.
Risco: o mais alto de todos, sem ganho proporcional. **Não recomendado.**

**Recomendação: Caminho B**, com uma barreira de automação por etapa aplicada imediatamente no Caminho A como medida de contenção — ou seja, a proteção contra E1+ automático não precisa esperar a nova camada ficar pronta.

---

## 17. Ordem segura de implantação

1. **Barreira de automação por etapa** (só E0), em dois pontos. Independente de tudo o mais.
2. Nova camada em **modo sombra**: o motor grava a ação prevista; ninguém executa, nada muda na tela.
3. Comparação por alguns dias entre a sombra e o comportamento atual.
4. Ação do Dia passa a **ler** a nova fonte.
5. Registro de resultado (ligação, reunião, mensagem) migra para as ações.
6. Desligar o disparo de E1+ dentro do tick, mantendo E0.
7. Congelar os caminhos legados de execução.

Como cada risco é evitado:
- **Avalanche**: data de virada explícita; nada é materializado retroativamente.
- **Duplicação**: chave determinística no banco + apenas um caminho executando por vez.
- **Dois motores**: só existe um decisor; a nova camada não decide.
- **Perda de histórico**: nada é apagado; as tabelas antigas permanecem legíveis.
- **E1+ automático**: barreira aplicada no passo 1, antes de tudo.
- **Quebra da E0**: a E0 nunca sai do tick; ela é a exceção declarada.
- **Notas e IDs**: preservados; o vínculo por ID é reforçado, nunca substituído.
- **GreenSales**: cópia em uma direção só.
- **Remarketing**: decidido explicitamente antes do passo 6 (ver decisões pendentes).
- **Ações manuais**: continuam permitidas; são humanas por definição.

---

## 18. Visão de longo prazo

A política deve ser **um único lugar declarado no servidor**, listando quais etapas têm automação de saída — hoje apenas E0. Mudar a política no futuro é acrescentar uma etapa a essa lista, não reescrever o sistema.

Para que isso nunca aconteça por acidente:
- a lista é **código**, não configuração de tela — ninguém automatiza uma etapa clicando;
- ela é aplicada em **dois pontos independentes**, então esquecer um não abre a porta;
- toda tentativa fora da lista é **registrada com motivo**, então uma automação acidental apareceria no log antes de virar mensagem;
- a Safety Lock permanece como camada final, independente da lista.

---

## Decisões necessárias antes de implantar

1. Remarketing e resposta automática: continuam automáticos ou entram na mesma regra da E0?
2. Itens `PENDING` já existentes na fila na data de virada: congelar ou converter?
3. Responsável padrão de uma ação cujo lead não tem executivo atribuído.
4. Biblioteca de conteúdos: migrar para versões prontas ou conviver com os dois modelos durante a transição?
5. Critério objetivo de "material já entregue" para permitir pular R3.
6. Data de virada do modelo.

Nada será implementado sem sua aprovação.
