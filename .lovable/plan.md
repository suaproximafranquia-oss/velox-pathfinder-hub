# Diagnóstico de engenharia — Pausar/Continuar do relógio /f

## Escopo

Auditoria estritamente somente leitura da implementação atual. Nenhum código, dado, relógio, sincronização ou ambiente será alterado.

## Análise

1. Mapear o estado persistido, cache, fórmula 720x, ativação/desativação, funções administrativas e cartão atual do relógio.
2. Inventariar os consumidores reais de `envNow()`, `envNowIso()`, `environmentClock()`, `Date.now()` e `new Date()` nos fluxos de motor, cadência, fila, Ação do Dia, compromissos, materiais e Portal.
3. Separar tecnicamente hora real do servidor, hora do navegador e hora virtual do ambiente, indicando o comportamento de cada consumidor durante uma pausa futura.
4. Rastrear GreenSales → espelho CRM → Portal dos Leads → Workspace → follow-up/compromissos, confirmando se a sincronização permanece independente do avanço virtual.
5. Avaliar persistência e concorrência: tick simultâneo, duplo Pausar/Continuar, cache entre instâncias, F5, nova sessão e reinício do servidor.
6. Definir, sem implementar, o menor estado adicional compatível com o registro atual em `test_batches` e a fórmula exata para congelar e retomar sem contabilizar o intervalo pausado.
7. Entregar a conclusão nas seções A–J solicitadas, incluindo tabela por arquivo/função, riscos reais e teste objetivo de aceitação.

## Limites

- Sem implementação, testes executivos, migration, deploy ou escrita no banco.
- Sem alterações em cadência, E/R/RF/V, Ação do Dia, GreenSales, Portal dos Leads, `/s` ou `/seg`.
- A análise não presumirá cobertura total: usos de hora real fora da abstração serão apontados como dependências ou riscos quando afetarem o comportamento esperado.
