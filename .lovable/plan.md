# Arquitetura Operacional — E0, Ação do Dia, Mensagens e Agendamentos

Rodada de diagnóstico. Nada foi alterado: sem código, sem banco, sem cron, sem envio. A Global WhatsApp Safety Lock permanece intacta.

Legenda: **[HOJE]** = existe no sistema. **[LIMITE]** = limitação confirmada do modelo atual. **[FUTURO]** = proposta, ainda não implantada.

---

## 1. E0 — a única automação

**[HOJE]** A E0 nasce na sincronização de leads: `runLeadSync` → `registerFirstContact` (`src/server/crm/first-contact.server.ts`). Se o momento cai fora da janela operacional, `deferFirstContact` grava o evento `e0_adiada` em `crm_lead_events` e o envio é adiado. Quando a janela abre, `processDeferredFirstContacts` varre os eventos `e0_adiada` dos últimos 3 dias (limite 200), descarta quem já tem `e0_simulada`/`boas_vindas_enviada` e processa **todos os pendentes em um único laço**. Em paralelo, `runRelationshipTick` (`scheduler.server.ts`, lote de 200) reconstrói cadências ausentes a partir de `crm_messages` com id `msg_e0_%`.

**Respostas 1–8**

1. Criação = sincronização; adiamento = evento `e0_adiada`; identificação = ausência de `e0_simulada`/`boas_vindas_enviada`; execução = laço do processador da fila ou resgate pelo tick.
2. **[LIMITE]** Porque a E0 não tem registro próprio de "quando deveria acontecer". A pendência é inferida da ausência de outro evento, e o processamento é por varredura em lote: se a varredura não roda (janela fechada, cron falho, trava antiabandono), tudo se acumula e sai junto na primeira varredura bem-sucedida.
3. **[FUTURO]** Uma linha por E0, criada no instante em que o lead é identificado, com `due_at` individual e `idempotency_key = lead_id + "E0" + ciclo`. O processador seleciona por `due_at <= agora` com limite pequeno por ciclo e ordenação por `due_at`, marcando cada linha como `PROCESSING` antes de agir (trava por linha). Rajada deixa de existir porque o lote é limitado e cada item tem rastro próprio.
4. **[FUTURO]** Estados explícitos na mesma linha: `IDENTIFICADA` → `PLANEJADA` (com `due_at`) → `AGUARDANDO` (janela ainda fechada) → `EXECUTADA` → `BLOQUEADA` (destino faltante, trava de segurança) → `FALHOU` (erro técnico, com contador de tentativas). Nunca inferidos por ausência de evento.
5. **[FUTURO]** Teto de itens por ciclo + descarte de itens vencidos além de um limite de idade configurável (viram `EXPIRADA`, exigindo decisão humana) + `PROCESSING` com carimbo de tempo para evitar dois processadores no mesmo item.
6. **[FUTURO]** "Enviada" só pode ser gravada pelo retorno do ponto de saída. `BLOQUEADA` e `FALHOU` são estados terminais distintos e a leitura da ficha (hoje `e0-panel.tsx`, já correta nesse aspecto) continua lendo o estado, nunca a intenção.
7. **[FUTURO]** Quatro carimbos na linha: `planejada_em`, `prevista_para`, `processada_em`, `resultado` (+ motivo). Histórico imutável em uma tabela de eventos da ação.
8. **[FUTURO]** Um único módulo de política da E0 (janela, intervalo, condição, whitelist de automação) consumido pelo planejador e pelo processador. Hoje **[LIMITE]** a regra está espalhada entre `e0-window`, `first-contact` e o tick.

---

## 2. E1 em diante — Ação do Dia

**[HOJE]** O tick do motor decide e executa na mesma passagem; qualquer etapa vencida tenta sair. Só a Safety Lock impede a saída real. **[LIMITE]** Não existe separação entre "decidir" e "mandar".

**Respostas 9–15**

9. **[FUTURO]** O motor passa a produzir **ação planejada**, não envio. O despachante automático só aceita etapas de uma **whitelist server-side** (`E0` e variantes). Qualquer outra etapa entregue ao despachante é recusada e registrada.
10. Pela chave da ação, que carrega `lead_id` canônico. A tela nunca infere o lead pelo card aberto.
11. Chave determinística `lead_id + etapa + ciclo` com unicidade no banco: recriar é no-op.
12. Atraso é **leitura de tempo**, não mudança de estado. A ação continua pendente até ter resposta.
13. **[FUTURO]** `PREVISTA`, `DISPONIVEL`, `EXECUTADA`, `EXECUTADA_NEGATIVA`, `PULADA`, `REAGENDADA`, `BLOQUEADA` — `ATRASADA` é derivada de `prevista_para < agora` e nunca substitui o estado.
14. "Não atendeu" = ação **executada** com resultado negativo (houve tentativa). "Pulei" = ação **não executada**, com justificativa e autor obrigatórios.
15. Nada expira por horário. Só resposta do executivo, reagendamento ou encerramento do ciclo tiram um item da lista.

---

## 3. Interação do executivo

**Respostas 16–20**

16. A estrutura proposta é adequada. Ajuste recomendado: um único envio ao servidor por resposta (resultado + observação juntos), evitando estados intermediários salvos pela metade.
17. **Ambos**: o estado atual vive na ação (leitura rápida, relatório); cada resposta vira evento imutável (auditoria e correções).
18. O clique em SIM/NÃO abre o formulário; a conclusão é o envio. Enquanto o servidor não confirma, a ação continua pendente.
19. Validação no servidor: justificativa não vazia e comprimento mínimo, senão a requisição é recusada — a interface é conveniência, não regra.
20. REAGENDAR encerra a ação atual como `REAGENDADA` e cria a nova ação vinculada à anterior, na mesma transação.

---

## 4. Reuniões

**[HOJE]** `daily-actions.ts` já tem `MEETING_FOCUS_WINDOW_MS` (15 min), buckets `agora/atrasada/hoje/futura`, precedência de fontes e colapso por lead. **[LIMITE]** É camada de leitura: não guarda estado nem resposta.

**Respostas 21–26**

21. Disponibilidade = `inicio - janela` (a janela vira parâmetro; 5 min para reunião). Cálculo no servidor, em America/Sao_Paulo.
22. Reunião passada permanece `atrasada` e mantém prioridade máxima até ter resposta — a regra atual de `resolveBucket` já é compatível.
23. A ação guarda a referência ao registro original em `portal_meetings`; horário, nome e telefone continuam sendo lidos de lá. Sem cópia.
24. Reagendar em uma transação: reunião original encerrada, nova reunião criada, nova ação com chave nova e ponteiro para a anterior.
25. Cadeia de eventos ligada por ID: reunião original → comparecimento → evolução → observação → reagendamento → nova reunião.
26. A interface só grava "não compareceu". Quem escolhe o R adequado é o motor, lendo o histórico do investidor.

---

## 5. Mensagens do Motor — versões completas

**Respostas 27–32**

27. **[FUTURO]** Evoluir a Biblioteca para armazenar **versões completas** por etapa: texto + link + rótulo (com nome / sem nome). Nada de montar link no instante da execução.
28. Sim. Remove a principal fonte de inconsistência: conteúdo e link deixam de poder divergir.
29. Uma linha por versão, com etapa, rótulo, texto, link e número de versão; o texto publicado é imutável — alteração gera nova versão.
30. A ação planejada guarda o **id da versão** usada. Alterar o texto depois cria versão nova e não reescreve o histórico.
31. **Determinística** (por exemplo, distribuição pelo ID do lead): reproduzível, auditável e distribui igualmente. Aleatório impede reproduzir o que aconteceu.
32. A ação já entrega texto final pronto para copiar, sem nenhuma montagem na tela.

---

## 6. Workspace / ID / notas

**Respostas 33–37**

33. O `lead_id` operacional (`portal_leads.id`), já usado como identidade em `daily-actions.ts`.
34. A nota é gravada com o `lead_id` que veio **da ação**, enviado pelo servidor.
35. O endpoint de nota exige o identificador da ação e deriva o lead dele; o lead selecionado na tela nunca é parâmetro aceito.
36. Notas são append-only: nova nota, nunca sobrescrita.
37. A gestora lê o mesmo agregador cronológico já existente (`journey.server.ts`), sem segunda base.

---

## 7. Relatório administrativo

**Respostas 38–42**

38. Contagem direta sobre os eventos das ações, agrupada por executivo, tipo e resultado.
39. Pelo estado: `EXECUTADA_NEGATIVA` ≠ `PULADA` ≠ `BLOQUEADA`; atraso é derivado do tempo.
40. Indicadores por campos categóricos, nunca por texto livre — justificativa é evidência, não métrica.
41. Filtros por executivo, período, tipo e resultado, todos sobre colunas indexadas.
42. Cada linha do relatório carrega o `lead_id`; o clique abre a ficha por ID.

---

## 8. Transição e segurança

**Respostas 43–48**

43. Três fases: (a) **sombra** — motor planeja ações mas não apresenta nem executa; (b) apresentação na Ação do Dia; (c) desligamento do despachante automático para tudo fora da whitelist. Nunca dois executores ao mesmo tempo.
44. Marco de corte: só etapas com vencimento a partir da data de ativação viram ação. O passado fica como histórico.
45. Reaproveitar como histórico: `relationship_queue`, `relationship_message_sends`, `crm_cadence_tasks`, `crm_lead_events`.
46. Deixa de executar: o despachante dentro do tick para E1+. Passa a apenas decidir e planejar.
47. Ordem de teste: E0 → planejamento em sombra → Ação do Dia → reuniões → mensagens → notas → relatório → migração.
48. A Safety Lock permanece intacta e o modo simulado continua ativo; nenhum teste alcança a Graph API.

---

## 9. Recomendação final

49. **Manter**: chave determinística e colapso por lead de `daily-actions.ts`; fuso operacional único; ficha da E0 como leitura pura; Safety Lock como ponto único de saída; whitelist de automação restrita à E0.
50. **Alterar antes de implantar**: centralizar a política da E0 num módulo só; dar linha própria e estado explícito a cada E0; separar decisão de execução no tick; migrar a Biblioteca para versões completas.
51. **Riscos ainda pouco visíveis**: (a) o resgate por `msg_e0_%` pode ressuscitar leads antigos na migração; (b) fila adiada com janela de 3 dias e limite 200 pode silenciosamente descartar pendências; (c) `crm_cadence_tasks` legado ainda alimenta ligações e pode duplicar ações no período de convivência; (d) relógio do navegador em qualquer decisão de tempo; (e) quando a Safety Lock um dia for retirada, qualquer caminho automático esquecido passa a enviar de verdade.
52. **Ordem de implantação**: 1) módulo de política + whitelist da E0; 2) linha e estados próprios da E0; 3) planejador em sombra para E1+; 4) Ação do Dia com respostas e eventos; 5) reuniões (janela de 5 min, comparecimento, reagendamento); 6) Biblioteca de versões completas; 7) notas por ID; 8) relatório; 9) desligamento do executor legado.
