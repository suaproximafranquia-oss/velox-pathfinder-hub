# Auditoria — Gestão de Usuários: status, exclusão e permissões

Somente diagnóstico. Nada foi alterado: nenhum arquivo, nenhuma migration, nenhum dado.

## 1. Status ativo/inativo

- Armazenamento oficial: tabela `executive_user_status` (`executive_id`, `status`, `updated_at`, `updated_by_name`).
- Escrita: `setExecutiveStatus` em `src/lib/executive-status.functions.ts`, chamada por `toggleStatus` em `src/routes/f.executivo.usuarios.tsx`.
- Autorização real: política RLS `admins write executive status` (`has_role(auth.uid(),'admin')`). Leitura liberada a membros do portal. Hoje só `usr_thiago` tem papel `admin`.
- Sessão viva: `OperationalGuard` (`src/components/auth/operational-guard.tsx`) consulta `situacaoOperacional` na entrada e a cada 60 s; resposta explícita "inativo" faz `signOut()`. Falha de rede não desloga (correto).
- Novo login: `ensureExecutiveAuthUser` (`src/lib/executive-auth.functions.ts`) recusa quem está `inativo`.

Funciona. Ressalva: a interface grava primeiro no navegador (`persist`) e só depois no servidor; se o servidor recusar, a lista local já mostra o novo estado até a próxima sincronização (o `catch` só exibe um `alert`).

## 2. Exclusão de usuário

- Ação: `remove()` em `src/routes/f.executivo.usuarios.tsx` → `persist(users.filter(...))` → `saveUsers` (`src/lib/executive-auth.ts`), que escreve apenas no `localStorage` `atlas:users:v3`.
- Não existe nenhuma função de servidor de exclusão. `executive_profiles`, `executive_user_status`, `workspace_module_permissions`, conta de autenticação e histórico permanecem intactos.
- Consequência prática (bug): os sete usuários vêm de `SEED_USERS` no código. `loadUsers()` sempre reinjeta o seed. Excluir some da tela até o próximo recarregamento, e o usuário volta — inclusive continuando apto a logar. Exclusão é hoje puramente visual e local ao navegador do Administrador.
- Lado positivo: nenhum risco de perda de histórico, justamente porque nada é apagado.

## 3. Permissões do Workspace (CRM / Portal dos Leads / E0)

- Fonte: `workspace_module_permissions` (`user_id` = `executive_id`, `module_key`, `enabled`).
- Escrita: `setWorkspacePermission` (`src/lib/workspace-permissions.functions.ts`), com a matriz do E0 validada no servidor (automático exige CRM e Portal ON; desligar qualquer um derruba o automático).
- Leitura: `listWorkspacePermissions`, cache reativo em `src/lib/workspace-permissions-store.ts` (poll de 15 s, foco e visibilidade) e hook `useWorkspacePermissions`.
- RLS: escrita só para `admin`; leitura para membros do portal. A UI reflete o retorno do servidor após cada gravação.
- Estado atual no banco: `usr_carlos/crm=false`, `usr_larissa/crm=false`, `usr_larissa/portal_leads=false`, `usr_larissa/e0_automatico=false`, `usr_thiago/e0_automatico=false`. Ausência de linha significa padrão (`defaultModuleAccess`), não OFF.

Este bloco está correto e é o padrão a ser seguido pelos demais.

## 4. Matriz de acesso aos módulos

- `ModuleAccessGuard` (`src/components/executive/module-access-guard.tsx`) é reativo, porém decide no cliente com o cache. É proteção de interface.
- A proteção real por módulo existe no servidor caso a caso: E0 usa `resolveExecutivePermissions`; áreas administrativas usam `readAdministrativeAccess`/`assertAdministrativeAccess`; o resto depende da RLS de cada tabela.
- Perfil (`role`) e status não são reavaliados dentro das server functions de dados: o token do Supabase permanece válido enquanto não expira, mesmo com o executivo marcado como inativo. A revogação hoje é feita pela camada de sessão do navegador, não pelo backend.

## 5. Sessão

- Inativação: o usuário é expulso em até 60 s pela verificação do guard, e o próximo login é recusado. Ponto de atenção: chamadas diretas a server functions com um token ainda válido não são bloqueadas por status.
- Permissões: alteração vale imediatamente (poll de 15 s) sem novo login.

## 6. Arquivos e tabelas

| Assunto | Arquivos | Tabelas |
| --- | --- | --- |
| Status | `f.executivo.usuarios.tsx`, `executive-status.functions.ts`, `executive-directory.functions.ts`, `operational-guard.tsx`, `executive-auth.functions.ts` | `executive_user_status` |
| Exclusão | `f.executivo.usuarios.tsx`, `executive-auth.ts` | nenhuma (só `localStorage`) |
| Permissões | `workspace-permissions.functions.ts`, `workspace-permissions-store.ts`, `use-workspace-permissions.ts`, `workspace-permissions-dialog.tsx`, `workspace-permissions.ts` | `workspace_module_permissions` |
| Cadastro/identidade | `executive-directory.functions.ts`, `executive-auth.ts` (SEED), `executive-auth.server.ts` | `executive_profiles`, `user_roles` |

## 7. Conclusão

Funcionando:
- Status com autoridade no banco, RLS de Administrador, revogação de sessão viva e recusa de login.
- Permissões CRM / Portal / E0 totalmente server-side, com matriz do E0 validada no servidor e propagação em tempo real.

Incorreto / bug:
1. Exclusão de usuário é falsa: só remove do `localStorage` e o seed recria o usuário no próximo carregamento. Bug de maior gravidade deste bloco.
2. Criação/edição de usuário nasce local; senha e credencial de login continuam presas ao `SEED_USERS` — um usuário criado pela tela não consegue entrar.
3. `persist()` aplica a mudança de status na tela antes da confirmação do servidor; erro só gera `alert`.
4. `executive_profiles` tem SELECT restrito ao próprio registro; para não-administradores o diretório volta parcial e a tela cai no seed.
5. Status não é revalidado dentro das server functions de dados (janela do token).

Riscos de uma correção:
- Excluir de verdade tocaria em identidade referenciada por leads, timeline, cadência e auditoria — o correto é desativar, nunca apagar.
- Mexer no seed sem migrar credenciais pode impedir o login de todos.
- Ampliar o SELECT de `executive_profiles` expõe dados de contato a mais perfis: deve ser feito com colunas limitadas.

## Menor construção segura recomendada (não executada)

1. Trocar o botão "Excluir" por "Desativar/Arquivar", reaproveitando o caminho já correto de `setExecutiveStatus`, e remover o `filter` local. Uma alteração, um arquivo (`f.executivo.usuarios.tsx`), sem migration e sem risco de perda de histórico.
2. Em seguida (opcional, mesma tela): só atualizar a lista depois que o servidor confirmar o status, substituindo o `alert` por `toast`.

Os itens 2, 4 e 5 da lista de bugs são construções maiores (cadastro no servidor, política de leitura, verificação de status no backend) e devem ser tratados em etapa própria.
