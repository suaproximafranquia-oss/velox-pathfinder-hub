# Plano — mapa operacional definitivo da Ação do Dia `/f`

## Resultado
- A fila existente passará a materializar exatamente os planos de ação informados para E, R, RE e RF.
- Toda ação de mensagem continuará buscando, no clique, a versão publicada vigente da Biblioteca para a etapa e o contexto real.
- E5 e RE2 aparecerão como execução manual de apresentação/material, sem abrir o modal comum de mensagem.
- O modal compartilhado abrirá após o carregamento da mensagem mesmo quando o navegador bloquear a cópia, com painel escuro opaco e os controles atuais preservados.

## Implementação
1. Tornar explícito, em uma única função de plano, o mapa de ligação, mensagem e material manual para E0–E8, R1–R4 e RE0–RE3, preservando a segunda ligação/compensação já existente de E1/E2.
   - Em toda etapa com ligação + mensagem, somente a ligação nasce primeiro; a mensagem é liberada pelo mecanismo atual depois da conclusão da ligação da mesma etapa.
   - As duas ações não serão obrigações independentes simultâneas.
2. Manter V2 e V3 somente como contextos de E2/E3; manter os dois contextos de E7/E8 e R3 resolvidos pelos fatos persistidos atuais.
3. Estender o vocabulário fechado de `action_kind` da mesma `relationship_queue` para aceitar `manual`, sem tabela, fila ou motor paralelo. RF0/RF1 continuam na mesma fila e somente como mensagem.
4. Exibir ações `manual` com comando próprio de conclusão, reutilizando exatamente a conclusão da fila, a trava, posição 1, histórico e avanço já existentes, sem consultar ou registrar mensagem da Biblioteca.
   - E5 concluída avança para E6 pela transição já definida.
   - RE2 concluída avança para RE3 pela transição já definida.
5. Separar no modal: carregar → abrir → tentar copiar. A falha do clipboard ficará como aviso e não impedirá abrir nem concluir após o conteúdo oficial estar visível.
6. Preservar `renderFromLibrary`, `prepareStepMessage`, `composeMessageBody`, proteção contra URL duplicada e ausência de fallback/hardcode.

## Validação objetiva
- Testes do plano completo: E0, E1, E2/V2, E3/V3, E4, E5, E6, E7/E8 nos dois contextos, R1–R4, RE0–RE3 e RF0/RF1.
- Testes focados da Biblioteca dinâmica e da composição idempotente de URL.
- Teste do controlador compartilhado do modal comprovando abertura com falha do clipboard.
- Typecheck, testes focados, build e verificação visual do modal em desktop e tela pequena.

## Áreas preservadas
- Nenhuma alteração em intervalos, transições, compromisso/congelamento, seleção/prioridade, GreenSales, Portal, Workspace, relógio, textos/versões da Biblioteca ou envio automático.
