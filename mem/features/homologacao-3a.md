---
name: Homologação do Motor (3A)
description: Simulador bilateral de 300 leads fictícios, biblioteca de conteúdos de valor e rodadas auditáveis em /executivo/homologacao
type: feature
---
FASE 3A concluída.

- Simulador bilateral: `src/lib/relationship/simulation.ts` (10 cenários A–J, 300 leads TEST-XXXX, relógio virtual, prova de resposta durante a fila). Teste: `simulation.test.ts` (300/300 conformes).
- Mensagens internas de homologação: `src/lib/relationship/messages.ts` (E0, E1, E3, E4, E12, V3, V4, R1, R2, R3).
- Biblioteca de conteúdos permanente: grupos E1, E3, R1, R2 (exigidos) + V3, V4; seleção controladamente aleatória entre os menos usados.
- Persistência: tabela `relationship_sim_runs` (rodadas RUN-001, RUN-002...), escopo `homologation`.
- Interface: `/executivo/homologacao` (somente super_admin) — biblioteca + execução da rodada + comparação esperado x realizado por cenário + histórico.
- Nenhum disparo real: despachante da simulação é de memória; produção, Portal dos Leads e GreenSales intocados.
