# Correção cirúrgica — modal de mensagem da Ação do Dia `/f`

## Objetivo
Garantir que toda ação com `kind="mensagem"` abra o mesmo segundo modal assim que a mensagem oficial for carregada, independentemente do resultado da cópia automática, e tornar o painel visualmente opaco e utilizável em telas menores.

## Causa confirmada
No mecanismo compartilhado de `DailyActionCard`, `handleOpenMessage()` carrega corretamente a mensagem, mas chama `setMessageOpen(copiedNow)`. Assim, uma falha do clipboard impede a abertura. O mesmo estado `copied` também bloqueia `handleRegisterMessage()` e desabilita “Concluído”, contrariando a regra solicitada para falha de cópia. O painel existente usa fundo translúcido (`bg-white/[0.03]`).

## Implementação
1. Alterar somente o fluxo compartilhado de mensagem em `DailyActionCard`:
   - manter `takeStepMessage`, `adapter.loadMessage`, `stepMessageKey` e toda a resolução oficial intactos;
   - após receber uma mensagem, gravar o estado e abrir o modal imediatamente;
   - tentar a cópia automática depois da abertura, usando o feedback atual de sucesso ou falha;
   - manter “Copiar novamente” disponível quando houver corpo;
   - permitir “Concluído” com mensagem oficial carregada mesmo quando o clipboard falhar, sem mudar a função de registro nem o backend de conclusão.
2. Preservar um único caminho para qualquer `item.kind === "mensagem"`, incluindo E0, E1, E2, E3, E4, E6, E7 e E8, sem condicionais por etapa.
3. Ajustar somente a apresentação do modal existente:
   - trocar o painel translúcido por um fundo sólido escuro do design atual;
   - manter overlay, cabeçalho, X, conteúdo, ficha, observação e ações;
   - manter altura máxima ligada à área visível, conteúdo rolável e rodapé acessível em viewport menor;
   - acrescentar os atributos de diálogo necessários sem substituir o mecanismo atual.
4. Não criar fallback quando a Biblioteca não retornar corpo. O modal continuará mostrando o bloqueio oficial já fornecido pelo fluxo existente.

## Validação
- Executar typecheck, build e os testes existentes relacionados à Ação do Dia e mensagens.
- Fazer validação focada, sem gravar dados reais, cobrindo:
  - o mesmo caminho compartilhado para E0, E1, E2, E3, E4, E6, E7 e E8;
  - abertura com clipboard funcionando e falhando;
  - conclusão disponível após falha do clipboard;
  - painel opaco;
  - rolagem e acesso a “Concluído” em viewport menor.
- Se alguma etapa não fornecer mensagem oficial, registrar a etapa e o motivo real, sem inventar conteúdo ou fallback.
- Conferir o diff final para assegurar que nenhuma regra, integração ou área fora do componente foi modificada.

## Arquivos previstos
- `src/components/crm/daily-action-card.tsx` — lógica compartilhada e apresentação do modal.
- Teste focado existente ou novo teste isolado do componente, somente se necessário para comprovar os cenários sem persistência.
- `roadmap.md` — registro conciso da tarefa e da validação, conforme o fluxo do projeto.

## Itens preservados
Cadência, motor, fila, ranking, posição 1, continuidade, ligação, conclusão server-side, Biblioteca, contextos, GreenSales, Portal, Workspace, relógio e ambientes `/s`, `/s/portal` e `/seg` permanecem intocados.
