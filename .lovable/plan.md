# Diagnóstico econômico

**NÃO.**

A remoção visual persiste apenas o arquivamento do card em `portal_leads` (`commercial_state`, `archived_at` e `archived_by`). Ela não altera o registro canônico em `crm_leads` usado por `intakeLead()` para calcular `created`, mudança de etapa e `enteredNow`.
