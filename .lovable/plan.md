# Validação da janela de acomodação da Ação do Dia /f

## Objetivo
Confirmar no preview da Financeira (/f) que a janela de acomodação de ~4 segundos está ativa e impedindo reentrada visual inesperada de ações recém-geradas, sem prejudicar a velocidade da transição.

## Passos
1. **Inspecionar o preview em /f/executivo/acao-do-dia** (ou rota equivalente usada pelo Executivo) e verificar que o painel carrega sem erro de console.
2. **Reproduzir o cenário crítico**: E0 → 2ª ligação → Não atendeu → Concluído.
   - O card atual deve sair imediatamente.
   - O próximo lead deve assumir a posição 1 imediatamente.
   - A mensagem E0 do mesmo investidor não deve aparecer de forma inesperada durante a troca; se surgir, deve respeitar a ordem oficial após a janela.
3. **Verificar reentrada tardia**: concluir várias ações rapidamente e observar se leads já concluídos "ressuscitam" fora de ordem quando respostas atrasadas chegam.
4. **Conferir a lista lateral**: confirmar que ações futuras permanecem visíveis em "Próximos compromissos", mas nunca ocupam a posição 1.
5. **Se tudo estiver correto**, encerrar sem alterações. **Se houver reentrada inesperada**, ajustar cirurgicamente apenas `daily-actions-overlay.tsx`, mantendo a regra de não bloquear a interface, não criar fila/motor/polling e não alterar /s, /s/portal, /seg, Biblioteca, GreenSales ou cadência.

## Escopo
- Apenas Financeira /f.
- Apenas `src/components/crm/daily-actions-overlay.tsx` e, se necessário, `src/components/crm/daily-action-card.tsx`.
- Nenhuma alteração em /s, /s/portal, /seg, Biblioteca, GreenSales, motor de cadência ou regras de negócio.

## Resultado esperado
Confirmação objetiva de que a janela está protegendo a fila, ou correção mínima caso falhe.
