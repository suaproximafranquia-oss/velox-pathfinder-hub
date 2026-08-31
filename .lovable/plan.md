# Diagnóstico e arquitetura futura — Cadência, Ação do Dia, Workspace e Auditoria

Somente análise. Nada foi alterado: sem código, sem banco, sem tabela, sem cron, sem envio. A Global WhatsApp Safety Lock permanece intacta.

---

## 1. E0 automática × demais etapas manuais

**1–2. Separar "decidiu" de "pode executar", com um só motor.** O motor (`decide.ts`/`machine.ts`) já é puro: ele calcula a etapa e nunca fala com a rede. O problema é `engine.ts`, que no mesmo ciclo decide e chama o dispatcher. A separação correta não é um segundo motor, é **retirar a execução de dentro do motor**: o resultado da decisão deixa de ser "envie" e passa a ser "existe uma ação prevista". Quem transforma previsão em envio é uma regra externa e única.

**3. Garantia de que nada além da E0 sai sozinho.** Uma **lista de automação de saída** server-side, com `E0` e `E0_V1` e nada mais, aplicada em dois pontos independentes:
- no executor (`runRelationshipTick`): etapa fora da lista nunca chega ao dispatcher, vira ação pendente;
- no ponto de saída (`whatsapp.server.ts`): recusa etapa fora da lista, do mesmo modo que a Safety Lock recusa por data.
Duas barreiras independentes significam que um job novo, escrito no futuro por engano, ainda esbarra na segunda. Toda recusa é registrada com motivo legível.

**4. Remarketing, resposta automática e envio manual.** São caminhos distintos e devem ser classificados explicitamente, não por omissão:
- **Envio manual pelo CRM** — é ação humana; permanece permitido.
- **Resposta automática** (`auto-reply.server.ts`) — é reativa a uma mensagem do investidor, não é cadência; decidir conscientemente se continua automática. Recomendação: manter, mas declarada na mesma lista, para ficar visível.
- **Remarketing** (`remarketing/engine.server.ts`, cron próprio) — é o maior risco: tem executor independente do motor. Recomendação: submetê-lo à mesma lista, senão a regra "só E0 é automática" tem uma porta lateral.

**5. Teste sem envio real.** Três camadas já disponíveis, nesta ordem: (a) testes unitários da regra de autorização, como foi feito na Safety Lock; (b) execução em modo sombra — o motor grava a ação prevista e não executa, e comparamos por alguns dias o que teria saído; (c) homologação com leads `TEST-` que nunca chamam a Meta. A Safety Lock continua como rede final.

---

## 2. Nova estrutura de ações

**6. Evoluir ou criar.** Recomendação: **estrutura central específica**, e `relationship_queue` deixa de ser fila de disparo. Motivo: hoje ela só representa mensagem do motor; a ação precisa representar também ligação, reunião e tarefa, com responsável, justificativa e resultado. Forçar isso na tabela atual mistura dois significados. A queue antiga vira histórico e continua legível.

**7. Duplicidade.** Chave determinística por ação — lead + etapa + ciclo — com unicidade no banco. Se o motor identificar a mesma etapa de novo, a gravação encontra a ação existente e não cria outra. A idempotência mora no banco, não na lógica de quem chama.

**8. Estados.** Pendente, Em execução, Concluída, Pulada, Reagendada, Bloqueada — como estado explícito. **Atrasada não é estado**: é uma leitura de `prazo < agora` sobre uma ação Pendente. Persistir "atrasada" exigiria um job varrendo o banco para mudar linhas, o que é justamente o que queremos evitar.

**9. Ação atrasada não some.** Consequência direta do item 8: nada muda de estado por passagem de tempo. A ação sai da lista quando o executivo registra resultado, pula com justificativa, ou o sistema a bloqueia por motivo nomeado. Nunca por horário.

**10. Falha isolada.** Uma ação por linha, cada uma com seu próprio estado e contador de tentativas. Processar em lote é permitido; **falhar em lote não**. Erro em uma ação registra motivo nela e não interrompe as demais — comportamento que o tick atual já tem para leads e que precisa valer por ação.

**11. Auditoria individual.** Cada ação carrega identidade própria e escreve em um histórico imutável de eventos (criada, apresentada, executada, pulada, reagendada, bloqueada). Nada é sobrescrito; o estado atual é a soma dos eventos.

---

## 3. Ação do Dia

**12–14. Horário e atraso.** A visibilidade é calculada na leitura: uma ação com horário aparece quando `agora >= horário − 5 min`; sem horário, aparece no dia devido. Passado o horário, a condição continua verdadeira — por construção ela **não pode** desaparecer. Nenhum processo encerra ação por tempo; encerramento é sempre um ato registrado, com autor.

**15–17. Pular.** Pular é uma transição de estado com autor, instante e **justificativa obrigatória** — obrigatória no banco, não só na tela, senão um caminho futuro grava sem justificativa. E pular é semanticamente diferente de resultado negativo:
- "não atendeu" = ação **executada** com resultado negativo;
- "pulada" = ação **não executada**, com motivo.
No relatório, os dois nunca podem cair na mesma coluna.

---

## 4. Resultado de ligação

**18. Sem cards desnecessários.** O resultado é um evento da ação, não um card do Workspace. A observação é um campo opcional do mesmo evento. Só vira nota visível no Workspace quando há texto — e ainda assim como nota, não como novo card.

**19. Histórico suficiente.** Cada ligação guarda: qual ação, qual lead, qual executivo, prazo, momento da execução, atendeu ou não, e a observação se houver. É o bastante para reconstruir o dia sem inflar a interface.

**20. Vínculo correto.** O `lead_id` vem **da ação**, nunca do que está selecionado na tela ou do nome exibido.

---

## 5. Resultado de reunião

**21. Estrutura.** Reunião = uma ação com horário, ligada ao registro de reunião existente (`portal_meetings`). O resultado é um evento; o reagendamento é **uma nova ação**, com referência à anterior. A reunião original nunca é reescrita.

**22. Reagendar sem duplicar.** A ação original é encerrada como "reagendada" no mesmo movimento que cria a nova. Uma transação, dois efeitos — não existe janela em que as duas estejam pendentes.

**23. Retorno ao fluxo R.** Quem calcula é o motor, a partir dos eventos já registrados — nunca um "reiniciar R" na tela. Se o lead já está em R, o motor aplica a ordem do fluxo (`R1 → R2 → R3`), que hoje já recusa etapa fora de ordem e etapa repetida. O histórico é preservado porque nada é apagado: adiciona-se o evento de não comparecimento.

**24. Eventos independentes.** Compareceu, houve evolução e deseja reagendar são **três eventos distintos**, cada um com sua resposta. "Houve evolução" é registrado como o executivo respondeu e **não é interpretado** pelo sistema — não muda etapa, não move o lead, não dispara nada.

---

## 6. ID único e Workspace

**25–26.** Três garantias em camadas: `lead_id` obrigatório e com chave estrangeira em toda ação, evento e nota; a interface envia sempre o identificador da ação, e o servidor deriva o lead a partir dela; e nenhuma escrita aceita nome como critério. Nome é campo de exibição, jamais de decisão. Vale registrar como regra fechada: **nada é gravado por nome**.

**27. Cadeia Ação → Workspace → Notes.** Um único identificador atravessa toda a cadeia. Hoje o Portal já resolve identidade por telefone/e-mail em `resolve_portal_identity` e existe `portal_leads.id` como identidade canônica — é essa que deve ser propagada, sem tradução intermediária.

**28. Central da gestora.** Mesma regra, sem exceção: a gestora vê mais leads, mas escreve pelo mesmo caminho e com o mesmo identificador. Nenhuma rota administrativa pode ter um atalho de gravação próprio.

---

## 7. Notes do Executivo

**29.** A nota guarda a referência da ação que a originou — dá para ir da nota à ação e da ação à nota.
**30.** Notas são **acrescentadas**, nunca sobrescritas: cada uma é uma linha com autor e instante.
**31.** Consulta da gestora por lead, por executivo e por período, lendo o mesmo histórico — sem relatório paralelo.
**32.** Estrutura recomendada: **ação** (estado atual) + **eventos da ação** (histórico imutável) + **notas** (texto visível no Workspace, derivado de um evento). Três papéis, sem sobreposição.

---

## 8. Mensagens do motor

**33. Sim, é mais simples e mais segura.** Hoje a mensagem se monta em tempo de envio a partir de vínculo etapa↔conteúdo, rotação determinística e busca na Biblioteca. Cada uma dessas etapas é um ponto de falha que hoje aparece como "sem vínculo — bloqueado". Guardar a **versão pronta, com texto e link juntos**, elimina a montagem: se a versão existe, a mensagem existe.

**34. Várias versões.** Uma etapa tem N versões; cada versão é uma linha com texto, link e o marcador de "com nome"/"sem nome". Uma versão → usa. Várias → rotação determinística, a mesma regra já usada hoje, agora sobre versões e não sobre conteúdos avulsos.

**35. Link próprio.** O link é campo da versão, não referência a outro módulo. Nenhuma busca posterior, nenhuma dependência da Biblioteca no instante do envio.

**36. Com a Ação do Dia.** A ação de mensagem já chega ao executivo com o texto e o link resolvidos, prontos para revisar e enviar. Ele vê o que vai mandar antes de mandar — que é exatamente o ganho do modelo manual.

Ponto a decidir: o que acontece com os vínculos e conteúdos já cadastrados na Biblioteca — migrar para versões ou manter os dois enquanto durar a transição.

---

## 9. Relatório administrativo

**37.** Se cada ação é uma linha com tipo, executivo, estado e prazo, o relatório é contagem direta — nunca leitura de texto.
**38.** Três colunas distintas por construção: concluída, concluída com resultado negativo, pulada. São estados diferentes, não interpretações.
**39.** Quem, quando e por quê ficam no evento de pulo, com justificativa obrigatória.
**40.** Cada linha do relatório carrega o `lead_id`; o clique abre o card por identificador, nunca por busca de nome.

---

## 10. Gestora / central única

**41. Encaixe atual.** Já existe base: papéis `admin`/`manager` e as funções `has_role`, `can_access_investor` e `current_executive_id`, que hoje concedem visão ampla a admin e manager e restringem o executivo à própria carteira.

**42. Limitações a considerar.** As permissões atuais foram desenhadas para leads e conteúdos; ações, eventos e notas serão objetos novos e precisarão das mesmas regras desde o primeiro dia — caso contrário nascem sem proteção ou sem acesso. E "gestora vê tudo" precisa significar **ler tudo**, não escrever em nome de outro executivo sem que isso fique registrado.

**43. Sem quebrar isolamento.** Leitura ampla para a gestão, escrita sempre atribuída a quem escreveu. Qualquer ação executada pela gestão em nome de um executivo fica marcada como tal.

---

## 11. Transição

**44. Estratégia.** Seis passos, cada um reversível:
1. Nova estrutura em **modo sombra**: o motor grava a ação prevista; ninguém executa e nada muda na tela.
2. Comparação por alguns dias entre a sombra e o comportamento atual.
3. Ação do Dia passa a ler a nova fonte, ainda só em leitura.
4. Registro de resultado (ligação, reunião, mensagem) migra para as ações.
5. Desligar o disparo dentro do tick, mantendo E0.
6. Congelar os caminhos legados de execução.

**45. Manter.** Motor de decisão, E0 e seu caminho próprio, Safety Lock, permissões, identidade do lead, todo o histórico.
**46. Perder função de execução.** O tick como disparador de E1 em diante; `crm_cadence_tasks` como fonte de ligações; e, se assim for decidido, o executor de remarketing.
**47. Reaproveitar como histórico.** `relationship_queue`, `crm_cadence_tasks`, `crm_messages`, `relationship_message_sends`, `crm_lead_events`, `relationship_engine_log` — todos permanecem legíveis.
**48. Sem duplicidade.** Enquanto durar a sombra, apenas um caminho pode executar; a chave determinística impede que a mesma etapa vire duas ações.
**49. Sem avalanche.** Data de virada explícita: nenhuma ação é materializada retroativamente. Itens `PENDING` antigos são congelados com motivo, não convertidos em massa.

---

## 12. Auditoria e segurança

**50. Estrutura de eventos.** Um registro por transição, sempre com: ação, lead, executivo, tipo, o que deveria acontecer, quando deveria, quando aconteceu, resultado, autor e justificativa. Toda pergunta da sua lista é respondida por uma consulta a esse histórico, sem interpretação de texto.
**51. Imutável.** Os eventos. O estado atual da ação pode mudar; o histórico só recebe linhas novas. Correção é um novo evento, nunca uma edição.
**52. Rastreabilidade por ID.** Uma cadeia sem tradução: lead → ação → eventos → notas → relatório, todos amarrados ao mesmo identificador.

---

## 13. Arquitetura recomendada

```text
MOTOR DE DECISÃO (puro, único)
   │  calcula a próxima etapa — nunca envia
   ▼
LISTA DE AUTOMAÇÃO DE SAÍDA  →  E0 (e só E0) executa sozinha
   │  todo o resto:
   ▼
AÇÃO PLANEJADA (uma linha, chave determinística, lead_id obrigatório)
   │
   ▼
AÇÃO DO DIA (apresenta; nada some por horário)
   │
   ▼
EXECUTIVO EXECUTA e REGISTRA RESULTADO
   │
   ▼
EVENTOS IMUTÁVEIS  →  Notes no Workspace  →  Relatório da gestão
```

Invariantes que essa forma preserva: um único motor de decisão; um único identificador por investidor; nenhuma gravação por nome; nenhuma execução automática além da E0, protegida em dois pontos; nenhuma duplicidade, garantida pelo banco; histórico imutável; e a Safety Lock intacta como camada final.

---

## Decisões necessárias antes de implementar

1. Remarketing e resposta automática continuam automáticos ou entram na mesma regra da E0?
2. Itens `PENDING` já existentes na fila: congelar ou converter?
3. Responsável padrão de uma ação cujo lead não tem executivo atribuído.
4. Biblioteca de conteúdos: migrar para versões prontas ou conviver com os dois modelos durante a transição?
5. Data de virada do modelo.

Nada será implementado sem sua aprovação.
