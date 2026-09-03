# Organização visual: E0 dentro de Permissões do Workspace

## Diagnóstico (estado real do código)

1. **Ícone de escudo** — em `src/routes/f.executivo.usuarios.tsx` (coluna Ações), o botão "Permissões do Workspace" chama `setPermissionsFor(u)` e abre o modal `WorkspacePermissionsDialog` (`src/components/executive/workspace-permissions-dialog.tsx`). Não é rota nova, é modal sobre a própria tela.
2. **Sim, essa área já é a verdadeira "Permissões do Workspace" individual.** O modal recebe o usuário selecionado e todas as gravações usam `user.id`.
3. **Os controles CRM e Portal de Leads já estão lá dentro** — e o E0 também já está (terceiro item do modal, como mostra o print enviado). Ou seja, a área correta já existe e já está completa.
4. **Vínculo de identidade correto**: o modal lê via `useWorkspacePermissions()` e grava por `setWorkspaceModuleAccess(user.id, key, next)` → `workspace_module_permissions (user_id, module_key, enabled)`, com validação da matriz no servidor (`workspace-permissions.functions.ts` + `first-contact-mode.server.ts`).
5. **Nada precisa ser criado.** Não há tela nova a construir.
6. **O problema é só duplicação na lista principal**: a coluna "Workspace" da tabela renderiza `WorkspaceBadges` (mesmo arquivo, final), que imprime CRM ON/OFF, Portal ON/OFF e E0 Manual/Automático em cada linha. Foi isso que poluiu a tabela — não há qualquer dependência funcional que obrigue essa exibição.
7. **Sim**, a tabela pode ficar apenas com Nome, E-mail, Perfil, Status (verde/vermelho, já implementado assim) e Ações.
8. **Confirmado**: o E0 aparece na tabela porque foi criado o componente de badges direto na lista, não por necessidade do motor.
9. **Confirmado**: nenhuma dependência funcional do E0 exige presença na tabela principal. O motor decide pelo executivo responsável, lendo o servidor.

## Correção proposta (visual apenas)

### Tabela de Gestão de Usuários
- Remover a coluna "Workspace" e o componente `WorkspaceBadges`/`StateBadge`, junto com os imports `useWorkspacePermissions`, `resolveE0Mode`, `resolveModuleAccess` que passam a ficar sem uso.
- Manter Nome, E-mail Corporativo, Perfil, Status (verde/vermelho) e Ações (editar, escudo, ativar/desativar, excluir), exatamente como hoje.

### Modal Permissões do Workspace
- Manter os três controles juntos, com hierarquia visual clara:
  - bloco "Módulos": CRM (ON/OFF) e Portal de Leads (ON/OFF);
  - bloco "Primeiro contato — E0": MANUAL / AUTOMÁTICO, visualmente separado dos módulos, indicando que depende deles.
- Cores: verde = ON / Automático; vermelho = OFF / Manual (já é o comportamento atual).
- Quando CRM ou Portal estiver OFF: controle Automático desabilitado com a mensagem "Automático disponível somente com CRM e Portal de Leads ativos."
- Cabeçalho do modal continua mostrando Nome, E-mail, Perfil e Status do usuário — status permanece conceito separado das permissões.

## O que NÃO muda
- Regra de negócio do E0, matriz servidor-side, gravação por executivo, ausência de reativação automática, consulta ao responsável pelo lead, Ação do Dia, Safety Lock.
- Nenhuma migration, nenhuma alteração de banco, nenhuma configuração global reintroduzida.
- Distinção entre "Portal de Leads" (módulo) e "Portal do Investidor" (origem).

## Arquivos afetados
- `src/routes/f.executivo.usuarios.tsx` — remover coluna e badges.
- `src/components/executive/workspace-permissions-dialog.tsx` — agrupamento visual e texto auxiliar.
