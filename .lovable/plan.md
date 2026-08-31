# Diagnóstico — E0 como única execução automática

Somente leitura. Nada foi alterado: sem código, sem tabela, sem cron, sem envio. A Global WhatsApp Safety Lock permanece intacta.

## Premissa registrada

No modelo operacional planejado, **E0 é a única etapa executável automaticamente**. Todas as etapas posteriores são **ações do executivo**, apresentadas na Ação do Dia. Identificar a próxima etapa nunca equivale a autorização de envio. Qualquer automação posterior será decisão futura e explícita.

Observação de nomenclatura: hoje o motor não usa E1–E8 em sequência. A sequência real é `E0 → E1 → E3 → E4 → E12 → E30` (fluxo sem resposta), com variantes `V3/V4`, `R1–R3`, `RE0–RE3`, `RF0/RF1`. A premissa se aplica igualmente: tudo que vem depois da E0, em qualquer fluxo, é ação humana.

## 1. Como o sistema diferencia a E0 hoje

A E0 tem tratamento próprio em quatro lugares:

- **Caminho de entrada exclusivo**: `registerFirstContact` (`first-contact.server.ts`), chamado pela sincronização de leads, e a fila de adiamento noturno (`first-contact-queue.server.ts`). Nenhuma outra etapa tem caminho de entrada próprio.
- **Envio próprio**: `e0.server.ts`, com ID determinístico `msg_e0_<leadId>` e snapshot congelado.
- **Regra de decisão**: em `decide.ts`, `FIRST_CONTACT_STEPS = ["E0","E0_V1"]` é a única exceção permitida enquanto o lead aguarda a primeira ação humana em NOVOS.
- **Evento distinto**: o motor gera `FIRST_CONTACT_SENT` para E0 e `MESSAGE_SENT` para as demais.

Fora isso, **E0 e as etapas seguintes compartilham a mesma máquina**: mesma `STEPS`, mesma `FLOW_SEQUENCE`, mesma fila `relationship_queue`, mesmo dispatcher.

## 2. Existe caminho que executa E1 em diante automaticamente?

**Sim.** Existe hoje e está ativo (contido apenas pela Safety Lock e pela ausência de credenciais da Meta):

1. `pg_cron` (1 min) → rota pública `api/public/crm/sync` → `runScheduledLeadSync`.
2. No fim da sincronização, `runRelationshipTick` (`scheduler.server.ts`) seleciona até 200 leads elegíveis — cadência aberta, tarefa vencida, ou E0 já enviada — e chama `engine.tick(leadId)` para cada um.
3. `decide.ts` devolve `send_step` para **qualquer** etapa vencida do fluxo, não só a E0.
4. `engine.ts` reserva o item na fila e chama `dispatcher.send` **no mesmo ciclo**. Não há nenhuma condição que restrinja a E0.

Caminhos secundários que também produzem saída sem ação do executivo: o executor de remarketing (`remarketing/engine.server.ts`, cron próprio) e a resposta automática (`auto-reply.server.ts`).

Conclusão: **hoje o sistema é auto-executor de toda a cadência**. Só não entrega porque a trava global bloqueia a rede.

## 3. Forma mais segura de separar sem criar dois motores

A separação não deve nascer de uma nova cadência paralela, e sim de **retirar a execução de dentro do motor**. O motor continua sendo o único que sabe qual é a próxima etapa.

Três camadas, um motor:

```text
DECIDIR            PLANEJAR                  EXECUTAR
decide.ts    →    ação pendente com     →   executivo, na Ação do Dia
(puro)            estado e prazo             (E0 = exceção automática)
```

Regras de contenção recomendadas, em ordem de implantação:

1. **Whitelist de automação de saída**: uma única constante server-side listando as etapas que o sistema pode executar sozinho — hoje apenas `E0` e `E0_V1`. O `tick` só chama o dispatcher se a etapa estiver nela; qualquer outra vira ação pendente. Isso é uma linha de defesa no ponto de execução, não um botão de tela.
2. **Segunda barreira no dispatcher**: mesmo que uma rotina futura tente enviar E1, o ponto de saída recusa etapa fora da whitelist, do mesmo modo que a Safety Lock recusa por data. Duas travas independentes.
3. **A fila deixa de ser gatilho**: `relationship_queue` passa a significar "previsto", não "pronto para disparar". Quem transforma previsão em envio é a whitelist (E0) ou o clique do executivo.
4. **Nada retroativo**: ao ligar o modelo, ações passadas não são materializadas em massa; só entram leads a partir da data de virada.

Assim não existem dois motores: existe o mesmo motor decidindo, e um único ponto que decide se aquilo pode sair sozinho.

## 4. Responsabilidades futuras por componente

| Papel | Componente |
|---|---|
| **A. Decidir a próxima etapa** | `decide.ts` / `machine.ts` — motor puro, sem rede. Continua como está. |
| **B. Registrar que existe ação a fazer** | Camada de planejamento (evolução de `relationship_queue` ou tabela de ações), uma linha por ação, com lead, etapa, prazo, responsável e estado. |
| **C. Apresentar ao executivo** | `buildDailyActions` / Ação do Dia — passa a ler essa fonte única em vez de agregar quatro origens. |
| **D. Executar** | Executivo, pela interface. Exceção única e explícita: E0, executada por `e0.server.ts`. |
| **E. Registrar resultado** | Histórico imutável por ação (feita, não atendeu, adiada, pulada com justificativa), sempre amarrado ao `lead_id` da ação — nunca ao lead "selecionado na tela". |

## 5. Como representar "identificou" x "executou"

Recomendação: tornar isso um **estado explícito, não uma inferência**.

- Toda ação nasce em estado equivalente a `PREVISTA` — o sistema sabe que a etapa chegou, e isso não autoriza nada.
- A transição para `EXECUTADA` só existe por dois caminhos nomeados: automação permitida (E0) ou registro do executivo.
- O campo que carrega essa autorização é a **etapa**, comparada à whitelist — não uma flag por linha, que poderia ser marcada por engano por um job.
- A tentativa de executar etapa não permitida é registrada em `relationship_engine_log` com motivo legível, do mesmo jeito que a Safety Lock registra hoje.
- Auditoria: uma ação previstas sem execução tem que ser visível como pendência, não desaparecer por atraso.

Em termos práticos: hoje "chegou a hora" e "envie" são o mesmo evento dentro de `engine.ts`. O objetivo é que passem a ser dois eventos distintos, com dois responsáveis distintos.

## Riscos a decidir antes de implementar

1. O que fazer com os itens `PENDING` já existentes em `relationship_queue` na virada — congelar ou converter.
2. Se remarketing e resposta automática permanecem automáticos ou entram na mesma regra.
3. Quem é o responsável padrão de uma ação cujo lead não tem executivo atribuído.

Nada será implementado sem sua aprovação.
