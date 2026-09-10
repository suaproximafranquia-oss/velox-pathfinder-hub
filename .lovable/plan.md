# Diagnóstico — por que a fila mudou de comportamento hoje (10/09) | /f

Nenhuma alteração foi feita. Abaixo, o que os dados de hoje e o código mostram.

## 1. O que aconteceu hoje

Novos leads chegaram durante a sua operação e viraram ações E0 do próprio dia, em blocos. Contagem real de itens criados hoje na fila do motor (horário UTC):

```text
02h  1 RE0        12h  3 E0 + 1 RE0     15h  6 E0 + 1 RE0     22h  5 E0 + 2 E1
04h  1 E0         13h  1 E0 + 4 RE0     18h  1 E0            23h 10 E0 + 8 E1
09h  1 E0                                19h  1 E0
```

Ou seja: não foi a fila que "se reorganizou sozinha" sem motivo — chegaram leads novos ao longo do dia, principalmente às 15h, 22h e 23h. Cada bloco novo passou à frente das atrasadas pela regra de prioridade (E0 = prioridade 2, atrasada = prioridade 3), e quando o bloco acabou a fila voltou às atrasadas. Exatamente o que você observou.

## 2. Onde a fila é recomposta

Não existe "fila da sessão". A lista é reconstruída inteira a cada leitura, sempre do servidor. Os momentos em que isso acontece:

- ao abrir o painel;
- a cada conclusão de ação — o servidor devolve a fila já recalculada e ela é aplicada na hora;
- reconferências curtas logo após concluir (900 ms, 2,2 s, 4 s e 7 s), para captar a ação que o motor acabou de criar;
- a cada 30 segundos há apenas uma reclassificação do que já está na tela (atrasada/hoje/futura). Essa não busca itens novos.

E o ponto central: toda leitura da fila também executa a rotina que cria a E0 dos leads novos em modo manual. Então, na prática, cada conclusão sua é também o momento em que os leads que chegaram entram na fila.

## 3. Por que os E0 entraram no meio da operação

Combinação de três coisas, todas intencionais hoje:

1. leads novos chegando ao longo do dia (GreenSales / entradas);
2. a leitura da fila cria a E0 desses leads no mesmo instante;
3. a ordenação coloca E0 acima de atrasada.

A ação que você estava atendendo não foi interrompida: enquanto está em atendimento ela fica reivindicada no banco e ocupa a posição 1. A troca de foco só pôde acontecer entre uma conclusão e a próxima ação — que é justamente quando a lista é recomposta.

## 4. Isso é esperado?

Sim, pela arquitetura atual. Não é bug de recomposição nem de continuidade.

- Ordenação correta: E0 antes de atrasada — regra vigente.
- Recomposição: acontece a cada conclusão, por desenho.
- Mudança do item em foco: só ocorre após concluir, nunca durante.
- Continuidade da mesma pessoa: só vale por 20 minutos, só quando a última ligação foi "não atendeu" e existe outra ação da mesma etapa; ela desempata dentro do mesmo nível, não cria prioridade.
- Entrada de novas ações: livre, a qualquer momento do dia.

## 5. Riscos reais

- Nenhuma ação atrasada é descartada ou pulada: elas continuam na lista, apenas abaixo dos E0.
- Risco de postergação: em dias de alto volume de entrada, o bloco de E0 se renova continuamente e as atrasadas podem ficar para o fim do dia ou não serem alcançadas dentro da janela operacional.
- Percepção de "pessoa diferente no foco": vem da recomposição entre conclusões, não de erro de ordem.

## 6. Comportamento correto possível, sem mexer na prioridade de E0

Três opções, em ordem de menor impacto (nenhuma implementada agora):

1. Apenas visibilidade: mostrar no painel quantas E0 novas entraram durante a sessão e quantas atrasadas aguardam — a ordem não muda, você só deixa de ser surpreendido.
2. Intercalação controlada: a cada N ações E0 consecutivas, a fila entrega uma atrasada, mantendo E0 acima em geral.
3. Corte de entrada por sessão: E0 criadas depois da abertura do painel entram, mas atrás do bloco de atrasadas que já estava aberto quando você começou.

## 7. Pontos exatos no código (referência, sem alteração)

- `src/lib/crm/daily-actions.ts` — `actionRank()`: E0 = 2, atrasada = 3; item reivindicado = -1.
- `src/server/crm/daily-actions-gate.server.ts` — `currentDailyAction()`: recalcula tudo e reivindica a posição 1; `recentContinuityLead()`: janela de 20 minutos.
- `src/server/crm/daily-actions.server.ts` (linhas 107-111) — cada leitura cria as E0 pendentes dos leads novos.
- `src/components/crm/daily-actions-overlay.tsx` — `commitQueue`, `scheduleSettle` (900/2200/4000/7000 ms) e a reclassificação de 30 s.

## Conclusão

Não há defeito. A fila mudou porque leads novos entraram durante a sua operação e a lista é recalculada a cada conclusão. A única decisão de negócio em aberto é se você quer que E0 novas entrem imediatamente à frente do bloco de atrasadas que já estava em andamento.
