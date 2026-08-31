# Continuidade da cadência após a Ação do Dia

Rodada de diagnóstico e planejamento. Nada foi alterado: sem código, sem banco, sem cron, sem envio. A Global WhatsApp Safety Lock permanece intacta.

Convenção adotada nesta e nas próximas rodadas:
- **[ATUAL]** — existe hoje no sistema (confirmado em código/banco).
- **[LIMITE]** — limitação confirmada do sistema atual.
- **[FUTURO]** — conceito especificado por vocês, ainda não implantado.
- **[RECOMENDAÇÃO]** — proposta técnica para transformar o atual no futuro.

Premissas do modelo futuro tratadas como especificação (não procuradas no código como se existissem): cadência E0→E8 com fluxos de retorno/reengajamento; E0 única automação; E1+ sempre manual via Ação do Dia; DECISÃO → PLANEJAMENTO → EXECUÇÃO → RESULTADO como estágios separados.

Verificações nesta rodada: `src/lib/relationship/types.ts`, `src/lib/relationship/machine.ts` (máquina de estados e prioridade de eventos), `src/lib/relationship/config.ts` (fluxo R1→R2→R3; não há R4), `src/lib/relationship/step-registry.ts`, `src/server/relationship/scheduler.server.ts`, `src/server/crm/cadence.server.ts` (fila de ligações legada com `outcome` SIM/NAO), `src/lib/crm/daily-actions.ts`.

---

## 1. Decidir ≠ executar

**[ATUAL]** O motor decide e executa na mesma passagem: em `machine.ts`/`engine.ts` a decisão vira imediatamente `FIRST_CONTACT_SENT`/`MESSAGE_SENT` e a etapa entra em `executedSteps`. O estado do lead vive em `relationship_cadences`.

**[LIMITE]** Não existe representação de "etapa decidida e ainda não executada" — o vocabulário de eventos só tem `..._SENT`, e `executedSteps` é preenchido no mesmo instante da decisão.

1. **[ATUAL]** Sim, a arquitetura permite: o motor já é a única fonte de decisão de etapa (`step-registry.ts` valida qualquer chave; `machine.ts` centraliza transições).
2. **[FUTURO]** Ação planejada em tabela própria, chave determinística `lead_id + etapa + ciclo`, estado `PLANEJADA` e `prevista_para`. Nenhum evento `*_SENT` nesse momento.
3. **[RECOMENDAÇÃO]** Novo evento `ACTION_COMPLETED` (etapa, tipo, resultado, referência da ação) entregue ao motor; só ele avança a cadência.
4. **[RECOMENDAÇÃO]** Imediatamente após o resultado (próxima ação aparece na hora), com o ciclo periódico apenas reconciliando — ambos pelo mesmo ponto de entrada.
5. **[LIMITE]** Sim — esse é o risco central hoje: se a etapa planejada for gravada em `executedSteps`, o motor a considera cumprida. **[RECOMENDAÇÃO]** `executedSteps` só é escrito no resultado, nunca no planejamento.

---

## 2. Resultado de ligação

**[ATUAL]** O motor legado de ligações (`cadence.server.ts`) já diferencia `outcome` SIM (atendeu) / NAO (não atendeu) e ancora a próxima tentativa nesse histórico — prova de que o modelo "tentativa com resultado" funciona.

6. **[FUTURO]** Estado + resultado na mesma linha: (A) `EXECUTADA`+`nao_atendeu`; (B) `EXECUTADA`+`atendeu`; (C) `PULADA`+justificativa+autor; (D) `BLOQUEADA`+motivo; (E) `PLANEJADA`/`DISPONIVEL`. Valores categóricos, nunca texto.
7. **[RECOMENDAÇÃO]** Sim, como contexto: alimenta a decisão da próxima tentativa, sem encerrar a cadência.
8. Porque `PULADA` não é execução: "realizadas" conta apenas `EXECUTADA`.
9. Colunas separadas: previstas, realizadas (atendeu/não atendeu), puladas, bloqueadas.

---

## 3. Resultado de mensagem manual

10. **[FUTURO]** `ACTION_COMPLETED` tipo `mensagem`, resultado `enviada`, id da versão usada, carimbo de tempo — registro interno, independente da Meta.
11. **[RECOMENDAÇÃO]** Declaração do executivo, marcada como envio manual, sem `wamid` e sem contato com a Graph API.
12/13. **[RECOMENDAÇÃO]** Confirmação separada ("Mensagem enviada"). Copiar é preparação e pode ocorrer por engano ou sem envio; só a confirmação explícita é afirmação do executivo. O clique em copiar pode virar evento auxiliar, sem alterar estado.
14. **[RECOMENDAÇÃO]** A ação guarda o id da versão e o texto congelado no planejamento; alterar a mensagem gera versão nova, sem reescrever histórico.
15. Porque o estado só muda no endpoint de confirmação; "copiada" não é estado.

---

## 4. "Houve evolução?"

16. **[FUTURO]** Campo booleano do resultado da reunião, sem nenhuma regra derivada. **[RECOMENDAÇÃO]** O motor pode lê-lo, mas nenhuma transição é condicionada a ele enquanto não houver regra escrita e aprovada por vocês.
17. Ambos: histórico permanente e contexto disponível — disponível não significa usado.
18. Separando "resultado informado" de "decisão comercial": só decisão explícita (seção 7) muda o rumo; `evolucao = false` nunca encerra nada.
19. **[RECOMENDAÇÃO]** Registrar: quem respondeu, quando, comparecimento/duração, se houve reagendamento e a observação livre — base para regras futuras sem reconstruir histórico.

---

## 5. Não compareceu e retorno ao R

**[ATUAL]** `CadenceRecord` já guarda `executedSteps`, `contentHistory`, `currentStep` e `flow`; reengajamento é `R1 → R2 → R3`. **[LIMITE]** Não existe evento estruturado de "não comparecimento", e `SCHEDULE_CREATED` apenas pausa (`SCHEDULED`) sem registrar desfecho da reunião. R4 não existe — é especificação futura.

20. **Parcialmente**: `executedSteps`/`contentHistory` bastam para saber onde o investidor parou; falta o não comparecimento como fato estruturado.
21. **[FUTURO]** Adicionar: não comparecimento (data + reunião de origem), distinção etapa executada x planejada, motivo de cada etapa não executada.
22. **[RECOMENDAÇÃO]** Etapa entra em "realizada" somente com resultado registrado e carimbo.
23. Pelo estado da ação: `PLANEJADA` nunca entra em `executedSteps`; só `EXECUTADA` entra.
24. **[RECOMENDAÇÃO]** Pulada = não executada (auditável, contabilizada como pulo), mas não bloqueia reapresentação. Decisão pendente de vocês: pular consome a etapa ou não?

---

## 6. Reagendamento

25. **[FUTURO]** A ação original permanece como `REAGENDADA`, nunca apagada.
26. Sim: a nova ação carrega a referência da anterior (cadeia).
27. O relatório conta apenas `EXECUTADA`; `REAGENDADA` é categoria própria.
28. A cadeia declara continuação: o motor conta reuniões realizadas, não ações criadas.

---

## 7. Encerramento da cadência

29. **[ATUAL]** Não existe campo/evento estruturado de "sem interesse" — só texto livre em observações e um placeholder em formulário de unidades.
30. **[FUTURO]** Resultado próprio da ação (`sem_interesse`) com autor, data e justificativa, distinto de `evolucao = false`.
31. **[RECOMENDAÇÃO]** Sim, estruturado. Observação é evidência, nunca gatilho.
32. **[RECOMENDAÇÃO]** Regra explícita: nenhuma rotina lê texto livre para decidir; observação não é entrada do motor.

---

## 8. Próxima ação

33. O motor, e só ele, a partir do evento de resultado. A Ação do Dia nunca cria etapa.
34. **[RECOMENDAÇÃO]** Decidir imediatamente e materializar a próxima ação; ciclo periódico só reconcilia.
35. Chave determinística com unicidade no banco: segunda criação é no-op.
36. Decisão sempre recalculada do estado atual do lead, não da ação que fechou; etapa em `executedSteps` não reabre.
37. **[ATUAL]** O motor já carrega o registro completo do lead (`executedSteps`, `contentHistory`) antes de decidir — o acréscimo futuro é incluir reuniões e não comparecimentos nesse carregamento.

---

## 9. Visão do executivo

38. Sim, coerente — desde que cor represente **resultado**, que só existe após resposta. Pendente não tem cor.
39. **[RECOMENDAÇÃO]** `PULADA` com identidade própria (neutra/âmbar, rótulo "pulada"), nunca vermelha.
40. Atraso é indicação de tempo (topo da lista + rótulo), nunca cor de resultado. **[ATUAL]** `resolveBucket` em `daily-actions.ts` já mantém `atrasada` como leitura de tempo — estrutura aproveitável.
41. **[RECOMENDAÇÃO]** Incluir: executivo responsável, etapa em linguagem humana, carteira/origem, última interação do investidor e observação mais recente.

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

Garantias:
- **Um motor só**: nenhuma outra parte decide etapa.
- **Uma fonte de verdade**: estado na ação, histórico nos eventos; relatório lê eventos.
- **Sem execução acidental**: whitelist server-side (só E0) no despachante.
- **Sem duplicidade**: chave determinística única.
- **Sem perda de histórico**: eventos append-only.
- **Nota no lead certo**: endpoint recebe o id da ação e deriva o `lead_id`.
- **Sem repetição**: `executedSteps` escrito só no resultado.
- **Sem avalanche**: marco de corte + teto por ciclo.
- **Sem envio não autorizado**: Safety Lock intacta como última barreira.

### Estruturas atuais aproveitáveis [RECOMENDAÇÃO]

- `machine.ts` (máquina de estados pura + prioridade de eventos) — recebe o novo evento de resultado sem mudar de natureza.
- `step-registry.ts` — aceita E5–E8 e R4 futuros por registro declarativo, sem lógica nova.
- `daily-actions.ts` (buckets, precedência, colapso por lead) — vira a camada de apresentação sobre a tabela de ações.
- `cadence.server.ts` (outcome SIM/NAO ancorando próxima tentativa) — modelo de resultado já validado.
- `e0-panel.tsx` — ficha como leitura pura do estado.

### O que é novo [FUTURO]

Tabela de ações planejadas com estados e resultados categóricos; tabela de eventos da ação (append-only); evento `ACTION_COMPLETED` no vocabulário do motor; whitelist de automação no despachante; resultado `sem_interesse`; evento de não comparecimento; cadeia de reagendamento; biblioteca de versões completas (texto+link imutáveis por versão); relatório administrativo por eventos.

### Decisões que dependem de vocês

1. Pular **consome** a etapa ou ela pode voltar depois?
2. **R4** entra no fluxo? Hoje só há R1→R2→R3.
3. Após "não compareceu", o retorno ao R é **na etapa seguinte à última executada**?
4. Quantas tentativas de ligação por etapa antes de o motor avançar sozinho?
5. Validade de uma ação pendente: visível indefinidamente ou expira após N dias úteis?
6. Rotação de versões de mensagem: por lead, por executivo ou sequência global?
7. Quem pode pular: só o executivo responsável ou também a gestão?
8. "Sem interesse" encerra a cadência de imediato ou apenas suspende?
9. Ações anteriores ao marco de corte entram na nova Ação do Dia ou ficam só como histórico?
10. Confirmação de mensagem enviada: obrigatória sempre, ou o copiar pode valer em casos específicos?
