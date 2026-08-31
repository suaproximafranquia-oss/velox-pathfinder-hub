# Continuidade da cadência após a Ação do Dia

Rodada de diagnóstico. Nada foi alterado: sem código, sem banco, sem cron, sem envio. A Global WhatsApp Safety Lock permanece intacta.

Legenda: **[HOJE]** = existe. **[LIMITE]** = limitação confirmada. **[FUTURO]** = proposta, não implantada.

Verificações feitas nesta rodada: `src/lib/relationship/types.ts` (eventos e `CadenceRecord`), `src/lib/relationship/config.ts` (fluxo R1→R2→R3), `src/lib/relationship/engine.ts` (decisão e execução acopladas), `src/server/relationship/scheduler.server.ts`, `src/server/crm/first-contact-queue.server.ts`, `src/lib/crm/daily-actions.ts`.

---

## 1. Decidir ≠ executar

**[HOJE]** O motor decide e executa na mesma passagem: em `engine.ts` a decisão vira imediatamente um evento `FIRST_CONTACT_SENT`/`MESSAGE_SENT`. O estado do lead vive em `relationship_cadences` (`currentStep`, `executedSteps`, `contentHistory`, `lastEventType`). **[LIMITE]** Não existe representação de "etapa decidida e ainda não executada" — o vocabulário de eventos só tem `..._SENT`.

1. Sim. O motor pode continuar sendo a única inteligência: basta que sua saída deixe de ser "enviar" e passe a ser "planejar", com um despachante automático restrito a uma whitelist (E0).
2. **[FUTURO]** Uma ação planejada, em tabela própria, com chave determinística `lead_id + etapa + ciclo`, estado inicial `PLANEJADA` e `prevista_para`. Não gerar nenhum evento `*_SENT` nesse momento.
3. **[FUTURO]** Um evento novo por resultado — `ACTION_COMPLETED` com etapa, tipo, resultado e a referência da ação. Só ele avança a cadência. `MESSAGE_SENT` deixa de ser produzido por decisão do motor.
4. Imediatamente após o resultado (para a próxima ação aparecer na hora), com o ciclo periódico como rede de segurança e reconciliação. Ambos entram pelo mesmo ponto, nunca por caminhos diferentes.
5. **[LIMITE]** Sim, esse é o risco central hoje: se a etapa planejada for gravada em `executedSteps`, o motor a considera cumprida. Regra futura: `executedSteps` só é escrito no resultado, nunca no planejamento.

---

## 2. Resultado de ligação

6. **[FUTURO]** Estado + resultado na mesma linha: (A) `EXECUTADA` + `nao_atendeu`; (B) `EXECUTADA` + `atendeu`; (C) `PULADA` + justificativa + autor; (D) `BLOQUEADA` + motivo; (E) `PLANEJADA`/`DISPONIVEL`. Todos são valores categóricos, nunca texto.
7. Sim, como **contexto**: "houve tentativa, não atendeu" alimenta a decisão da próxima tentativa, mas não encerra a cadência.
8. Porque `PULADA` não é um resultado de execução: a contagem de "realizadas" olha apenas o estado `EXECUTADA`.
9. Três colunas distintas: previstas, realizadas (com desdobramento atendeu / não atendeu) e puladas. Bloqueadas em uma quarta coluna.

---

## 3. Resultado de mensagem manual

10. **[FUTURO]** `ACTION_COMPLETED` com tipo `mensagem`, resultado `enviada`, id da versão usada e carimbo de tempo — um registro interno, independente da Meta.
11. Exatamente assim: o registro é declaração do executivo, marcado como envio manual, sem `wamid` e sem qualquer contato com a Graph API.
12. Não. Copiar é preparação, não execução.
13. **Recomendo confirmação separada** ("Mensagem enviada"). Copiar pode acontecer por engano, duas vezes, ou sem envio; só a confirmação explícita é uma afirmação do executivo — e o relatório precisa dessa distinção. O clique em copiar pode ser registrado como evento auxiliar, sem alterar o estado.
14. A ação guarda o **id da versão** e o texto congelado no momento do planejamento. Alterar a mensagem depois gera nova versão e não reescreve o histórico.
15. Porque o estado só muda no endpoint de confirmação; "copiada" não é estado.

---

## 4. "Houve evolução?"

16. **[FUTURO]** Campo booleano do resultado da reunião, sem nenhuma regra derivada dele. O motor pode lê-lo, mas nenhuma transição é condicionada a ele enquanto não houver regra escrita e aprovada.
17. Ambos: histórico permanente e contexto disponível ao motor — disponível não significa usado.
18. Separando "resultado informado" de "decisão comercial". Só uma decisão explícita (item 7 abaixo) muda o rumo da cadência; `evolucao = false` nunca encerra nada.
19. Mínimo recomendado: quem respondeu, quando respondeu, duração/comparecimento, se houve reagendamento e a observação livre. Com isso, regras futuras podem ser criadas sem reconstruir histórico.

---

## 5. Não compareceu e retorno ao fluxo R

**[HOJE]** `CadenceRecord` já guarda `executedSteps`, `contentHistory`, `openingTemplateHistory`, `currentStep` e `flow`; o fluxo de reengajamento é `R1 → R2 → R3` (não há R4 no motor atual — **[LIMITE]** o modelo futuro cita R4, que hoje não existe).

20. **Parcialmente.** `executedSteps` e `contentHistory` bastam para saber onde o investidor parou no R e o que já recebeu. O que falta é registro de **não comparecimento** como fato estruturado — hoje não existe evento desse tipo no vocabulário do motor.
21. Adicionar: não comparecimento (com data e reunião de origem), etapa efetivamente executada x planejada, e o motivo de cada etapa não executada.
22. Marcar a etapa como executada **somente** quando houver resultado registrado, com o carimbo do resultado.
23. Pelo estado da ação: `PLANEJADA` nunca entra em `executedSteps`; só `EXECUTADA` entra.
24. **Pulada = não executada.** Fica no histórico como pulada (auditável, contabilizada como pulo), mas não bloqueia a repetição da etapa se o motor decidir reapresentá-la. Regra a confirmar por vocês: se pular deve ou não consumir a etapa.

---

## 6. Reagendamento

25. Sim: a ação original permanece para sempre como `REAGENDADA`, nunca apagada.
26. Sim: a nova ação carrega a referência da anterior, formando cadeia.
27. O relatório conta apenas ações com estado `EXECUTADA`; `REAGENDADA` é uma categoria própria.
28. Porque a cadeia diz explicitamente que a segunda é continuação da primeira: o motor conta reuniões realizadas, não ações criadas.

---

## 7. Encerramento da cadência

29. **Não.** A busca no código não encontrou nenhum campo ou evento estruturado de "sem interesse" — só um texto de exemplo em um formulário de unidades. Hoje isso só existiria como observação livre.
30. **[FUTURO]** Um resultado próprio da ação (por exemplo `sem_interesse`), com autor, data e justificativa, distinto de `evolucao = false`.
31. Sim, estruturado. Observação é evidência humana, nunca gatilho.
32. Nenhuma rotina deve ler texto livre para tomar decisão. Regra explícita: observação não é entrada do motor.

---

## 8. Próxima ação

33. O **motor**, e só ele, a partir do evento de resultado. A Ação do Dia nunca cria a próxima etapa.
34. Decidir imediatamente e materializar a próxima ação, com o ciclo periódico apenas reconciliando o que faltou.
35. Pela chave determinística com unicidade no banco: a segunda tentativa de criar a mesma ação é no-op.
36. Porque a decisão é sempre recalculada a partir do estado atual do lead, não a partir da ação que fechou; etapa já em `executedSteps` não é reaberta.
37. O motor carrega o registro completo do lead (`executedSteps`, `contentHistory`, reuniões, não comparecimentos) antes de decidir — a ação nunca decide sozinha.

---

## 9. Visão do executivo

38. Sim, é coerente — desde que cor represente **resultado**, e resultado só exista após resposta. Ação pendente não tem cor de resultado.
39. `PULADA` com identidade visual própria (por exemplo neutra/âmbar com rótulo "pulada"), nunca vermelha.
40. Atraso é indicação de tempo (rótulo/ordem no topo), nunca cor de resultado. A ação atrasada continua pendente.
41. Recomendo incluir: executivo responsável, etapa em linguagem humana, origem/carteira do lead, última interação do investidor e a observação mais recente.

---

## 10. Arquitetura recomendada

```text
MOTOR (decide)  →  PLANEJADOR (grava a ação, chave lead+etapa+ciclo)
                       │
                       ├── whitelist E0 → despachante automático → Safety Lock → canal
                       └── E1+ → AÇÃO DO DIA (apresenta) → executivo responde
                                     │
                                     └── EVENTO DE RESULTADO (imutável)
                                              └── MOTOR decide de novo
```

Garantias, uma a uma:
- **Um motor só**: nenhuma outra parte decide etapa; a Ação do Dia apenas apresenta e coleta resultado.
- **Uma fonte de verdade**: estado atual na ação, histórico nos eventos; o relatório lê eventos, nunca uma segunda base.
- **Sem execução acidental**: whitelist server-side (só E0) no despachante; qualquer outra etapa é recusada e auditada.
- **Sem duplicidade**: chave determinística com unicidade no banco.
- **Sem perda de histórico**: eventos append-only, ação nunca apagada.
- **Nota no lead certo**: o endpoint recebe o id da ação e deriva o `lead_id`; o lead selecionado na tela nunca é parâmetro.
- **Sem repetição indevida**: `executedSteps` escrito só no resultado.
- **Sem avalanche**: marco de corte na ativação + teto de itens por ciclo.
- **Sem envio não autorizado**: Safety Lock permanece como última barreira, intocada.

### Decisões que ainda dependem de vocês

1. Pular **consome** a etapa ou ela pode voltar depois?
2. Existe **R4** no modelo futuro? Hoje o motor tem apenas R1→R2→R3.
3. Após "não compareceu", o retorno ao R é **na etapa seguinte à última executada** — confirmam?
4. Quantas tentativas de ligação por etapa antes de o motor avançar sozinho?
5. Prazo de validade de uma ação pendente: fica visível indefinidamente ou expira depois de N dias úteis?
6. Rotação de versões de mensagem: por lead, por executivo ou por sequência global?
7. Quem pode pular: o executivo responsável apenas, ou também a gestão?
8. "Sem interesse" encerra a cadência de imediato ou apenas suspende?
9. Ações antigas (anteriores ao corte) entram na nova Ação do Dia ou ficam só como histórico?
10. Confirmação de mensagem enviada: obrigatória sempre, ou o copiar pode valer para casos específicos?
