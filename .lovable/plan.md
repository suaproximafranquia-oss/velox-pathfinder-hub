# Estudo de esforço e consumo — Laboratório de Homologação Permanente da régua /f

Somente estimativa. Nada foi alterado, criado ou executado.

## 1. É viável?

Sim. A base necessária já existe e é justamente o que torna a versão adaptativa possível: a régua é declarativa (`src/lib/relationship/config.ts` com `STEPS` e `FLOW_SEQUENCE`, mais `flow-plan.ts`, `cadence-v2.ts`, `step-registry.ts`). Como as etapas, sequências e prazos são dados e não código espalhado, o laboratório pode ler a régua vigente a cada execução em vez de guardar uma cópia.

## 2. O que já dá para reaproveitar

- Laboratório de lotes atual (`src/server/testing/test-lab.server.ts`, `src/lib/testing/test-lab.ts`): personagens fictícios, `is_test` + `test_batch_id`, entrada pelo caminho real, limpeza por lote.
- Régua declarativa e o plano de ciclo já calculado por `flow-plan.ts` / `cadence-v2.ts` — é daqui que sai a matriz de cenários.
- Relógio abstrato `src/lib/relationship/clock.ts` (virtual já previsto, só nunca ligado à régua da Financeira).
- Modo de execução simulado (`execution-mode`) e a trava global de WhatsApp: mensagem real já é bloqueada em três camadas.
- Ação do Dia, Portal/Jornada, identidade e reentrada: são as estruturas oficiais, o laboratório apenas observa.

## 3. O que precisa ser construído

1. **Leitor da régua vigente**: percorre `STEPS`/`FLOW_SEQUENCE`/contextos e devolve a lista real de etapas, transições, bifurcações e tempos daquele momento.
2. **Gerador de matriz de cobertura**: a partir dessa leitura, deriva os cenários mínimos e quantos personagens são necessários.
3. **Ciclo do motor restrito a um lote**: hoje o tick é global; precisa aceitar uma lista de personagens.
4. **Executor de dias virtuais em série**: desloca as datas apenas do lote, roda o ciclo, espera concluir, avança. Intervalo configurável e medido, nunca por temporizador fixo.
5. **Validador**: compara o que aconteceu com o que a régua vigente previa, etapa por etapa.
6. **Relatório aprovado/reprovado** por personagem e por transição.
7. **Rollback ampliado**: hoje só leads e cards carregam a marcação; jornada, engajamento, compromissos, notas, tarefas, envios e log do motor precisam entrar na limpeza por lote.
8. **Blindagens**: marcação de teste preservada quando o card é recriado por sincronização, identificadores fictícios que não colidem, e a garantia de que o relógio virtual e o processamento acelerado jamais alcancem lead real.

## 4. Régua vigente a cada execução — sim

Sem segunda fonte de verdade. O laboratório não descreve a cadência; ele lê a oficial e monta o teste em cima dela. Se amanhã uma etapa mudar de nome, prazo ou posição, o teste de amanhã já nasce diferente. O limite honesto: o laboratório consegue derivar automaticamente **etapas, ordem e tempos**; as bifurcações que dependem de comportamento humano (atendeu, pediu material, agendou, voltou a frios, reentrou) precisam de um catálogo de comportamentos mantido à mão — pequeno, mas não automático. Uma bifurcação genuinamente nova só é coberta depois que alguém a declara nesse catálogo; o laboratório pode, porém, **acusar** que existe uma transição sem cobertura.

## 5. Esforço

**Grande.** Não pela complexidade de cada peça, e sim pela quantidade de superfícies tocadas: motor, fila, Ação do Dia, Portal, identidade, limpeza e uma tela de acompanhamento. É trabalho de vários blocos, não de uma sessão.

## 6. Consumo de créditos

Faixas para a construção completa, no estado atual do projeto:

- **Otimista:** ~250–400 créditos — construção em etapas, escopo fechado, poucas idas e voltas, validação por lote pequeno.
- **Provável:** ~450–750 créditos — inclui ajustes de rollback, correções de comportamento observado no primeiro lote real e refinamento do relatório.
- **Conservador:** ~900–1.400 créditos — se o ciclo restrito exigir mexer no scheduler global, se aparecerem tabelas derivadas não mapeadas, ou se cada rodada de teste precisar de várias execuções para estabilizar.

Fatores que fazem variar: quantidade de tabelas derivadas a mapear na limpeza; se o tick global aceita filtro com pouca cirurgia ou não; quantos ciclos de "rodar → observar → corrigir" o teste temporal exigir; e o quanto o relatório precisa ser detalhado.

## 7. Onde o crédito corre mais risco

O **executor de dias virtuais** e o **rollback completo**. Ambos só se provam rodando, e cada rodada consome. É a parte que pode entrar em ciclo de tentativa e erro. O leitor da régua e o gerador de matriz, ao contrário, são baratos e previsíveis.

## 8. Divisão em etapas (recomendada)

1. Leitor da régua + relatório de cobertura, **sem executar nada**. Barato e já revela lacunas.
2. Rollback ampliado e blindagem da marcação de teste. Isolado e verificável.
3. Ciclo restrito ao lote.
4. Executor de dias virtuais com intervalo configurável.
5. Validador e relatório aprovado/reprovado.
6. Tela de acompanhamento.

Cada etapa entrega valor sozinha; dá para parar em qualquer ponto sem desperdício.

## 9. Menor versão realmente útil

Etapas 1 a 4 acima: cria lote, isola personagens, lê a régua atual, executa em dias virtuais e limpa tudo — com a validação feita a olho pelo relatório de cobertura. Isso já homologa. O validador automático e a matriz inteligente vêm depois.

## 10. Maiores riscos

- **Técnico:** o ciclo do motor hoje é global. Se acelerar o lote significar acelerar produção, o laboratório é inviável até esse ponto estar resolvido. É o primeiro item a provar.
- **De desatualização:** o catálogo de comportamentos humanos. Etapas e tempos o laboratório lê sozinho; um caminho novo criado no futuro pode passar despercebido. Mitigação: o relatório deve listar explicitamente toda transição da régua vigente **sem personagem que a cubra**, transformando a lacuna em alerta visível em vez de silêncio.
