# Roadmap

- [x] Cobrir workspace_e0_actions no backup (capturar + nunca restaurar)
- [x] Modo Demonstração da Ação do Dia (overlay agnóstico + fixture em memória + rota /f/executivo/acao-do-dia-demo)
- [x] Central de Homologação (abas Motor + Ação do Dia Demo) e fotografia temporária das etapas (Word deixa de ser fonte operacional)
- [x] Landing institucional do Grupo Velox na rota / (componentes isolados em src/components/group/landing)
- [ ] FASE 1 — Fundação de identidade canônica (investors + investor_identifiers + vínculos investor_id, aditiva, sem alterar operação)
- [x] Alavanca 1 de homologação — mover `cadence_activation_date` da Financeira para o marco oficial (2026-09-03), medindo a Ação do Dia antes/depois (sem reset destrutivo)
- [ ] Teste controlado pós-corte: 1 lead fictício com responsável definido (Thiago) e E0 Automático — BLOQUEADO: o laboratório atual cria o lote sem responsável (intakeLead sem connectionUserId), o que força E0 Manual

## E0 fora da janela (04/09)
- [x] Card criado antes da trava de janela no intakeLead (responsável + is_test preservados)
- [x] processDeferredFirstContacts reutiliza card, preserva responsável/teste e respeita Automático x Manual
- [ ] Segundo lead de teste dentro da janela (a criar manualmente)
