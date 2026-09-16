# Integração Encerrar/Reabrir com a cadência

## Objetivo
Conectar os controles existentes de Portal, TikTok e Meta ao ciclo oficial, sem criar motor, fila ou fonte de verdade adicional.

## Implementação
- Manter `closed_at` como sinal persistido do encerramento e reconhecer esse sinal no estado server-side da régua V2 apenas para Portal/TikTok/Meta.
- Ao encerrar, preservar cadastro e histórico, colocar a instância ativa em interrupção e neutralizar as obrigações operacionais abertas com um motivo técnico próprio, distinto de execução.
- Fazer o agregador e todas as reconciliações respeitarem o encerramento, impedindo reaparecimento ou nova materialização enquanto `closed_at` estiver preenchido.
- Ao reabrir, limpar `closed_at`, reativar a mesma instância e recalcular pelo histórico persistido. Cancelamentos causados pelo encerramento serão ignorados na reconstrução, permitindo retomar a etapa não executada; somente `EXECUTED` avançará a régua.
- Materializar apenas a obrigação imediatamente correta usando as chaves e idempotência atuais.
- Preservar o comportamento atual de Pular e deixar GreenSales fora da nova integração.

## Validação
- Criar testes focados para E0–E4, Portal/TikTok/Meta, pulo, reconciliação, reload, repetição e preservação de `EXECUTED`.
- Executar testes focados, verificação de tipos, compilação e Preview autenticado quando a sessão estiver disponível.
- Não publicar e não alterar dados reais.

## Detalhes técnicos
- Reutilizar os eventos/estados existentes de interrupção e retomada da instância ativa.
- Usar um `cancel_reason` específico de encerramento manual e excluí-lo do replay como neutralização, sem convertê-lo em execução.
- Fazer fechamento, neutralização e reabertura por funções server-side autenticadas, com verificação da origem do lead.
