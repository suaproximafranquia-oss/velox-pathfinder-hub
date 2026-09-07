# Diagnóstico (somente leitura) — Central de Templates × E0 × Remarketing (/f)

Nada foi alterado: sem migração, sem edição de código, sem mudança de dados.

## 1. CENTRAL DE TEMPLATES

ESTADO ATUAL
- Rota `/f/executivo/templates` funcional, protegida por `WorkspaceResourceGuard resource="templates"`.
- Acesso: apenas Administrador (`ROLE_MATRIX.templates = ADMIN`). No servidor, `assertManager` aceita `super_admin` e `diretora` — ou seja, a porta da tela é mais restrita que a porta do servidor.
- Criar/editar/ativar/desativar/excluir: mesmas permissões de servidor (`super_admin`/`diretora`); na prática só o Administrador chega à tela.
- Cadastro por captura de tela do Gerenciador da Meta: a imagem é lida por IA (`interpretMetaTemplateCaptures`, gemini-2.5-flash, temperatura 0, instrução "nunca inventar"; campo não visível vira null). O operador revisa e confirma; edição manual dos campos existe na tela.
- Validação: apenas `name` obrigatório (Zod). Todos os outros campos são texto livre/opcional. Há detecção de duplicidade por `meta_name` + `language`, com confirmação de sobrescrita.
- Exclusão: chama `deleteMetaTemplate` direto, **sem diálogo de confirmação**.

ARMAZENAMENTO (tabela `crm_meta_templates`)
- Armazenados: `meta_id`, `meta_name`, `language`, `category`, `status`, `header`, `body`, `footer`, `buttons` (jsonb), `variables` (jsonb), `purpose`, `notes`, `is_active`, `meta_updated_at`, `created_by`, `created_by_name`, `created_at`, `updated_at`.
- Não existe "atualizado por": `created_by`/`created_by_name` são sobrescritos a cada upsert; não há autor separado da edição.

FUNÇÕES (`src/lib/crm/meta-templates.functions.ts`)
- listar: `listMetaTemplates` (admin) e `listCrmRelationshipTemplates` (só `is_active = true`, sem checagem de papel)
- criar/editar: `saveMetaTemplate` (upsert único)
- ativar/desativar: `setMetaTemplateActive`
- excluir: `deleteMetaTemplate`
- leitura da captura: `interpretMetaTemplateCaptures`

RISCO REAL: baixo hoje (0 registros); exclusão sem confirmação é o único ponto sensível.

## 2. STATUS META

ESTADO ATUAL
- `status` é `text` livre, salvo exatamente como a IA leu na captura. Não há enum, normalização, nem validação.
- Única comparação em todo o código: `e0-template.server.ts:66` → aceita `aprovado`, `approved`, `ativo` (minúsculas). Qualquer outro valor rejeita o template para envio real. Status vazio/null **passa** (não bloqueia).
- Não há uso de `pendente`, `pending`, `rejeitado`, `rejected`, `paused` em nenhum lugar.

DIVERGÊNCIAS
- A tela permite marcar `is_active = true` mesmo com status não aprovado; o backend não impede — só a E0 verifica, e apenas no momento do envio.
- "Aprovado pela Meta" (`status`) e "ativo no Portal" (`is_active`) são campos distintos, porém não relacionados por nenhuma regra: hoje as duas noções convivem sem consistência garantida.

## 3. TEMPLATE VIGENTE

- Não existe conceito de vigente/default. Nenhuma restrição de unicidade por `purpose`.
- Podem existir vários templates ativos com `purpose = primeiro_contato`.
- A E0 escolhe: `purpose = primeiro_contato` → `order by updated_at desc` → `limit 1`. Ignora `is_active`.
- Portanto a escolha é determinística (o mais recentemente atualizado), mas frágil: salvar um rascunho novo troca silenciosamente o template da E0, e desativar não tira o template da E0.

## 4. E0

- Tabela: `crm_meta_templates`. Filtro: `purpose = 'primeiro_contato'`, ordenado por `updated_at desc`, `limit 1`.
- Sem template, ou sem `meta_name`, ou com status fora da lista aceita → retorna `null`.
- Nesse caso a E0 continua rodando: registra a mensagem e marca entrega externa pendente com motivo legível (`E0_TEMPLATE_MISSING_REASON`); apenas o envio real fica bloqueado.
- Safety Lock permanece independente e anterior a tudo (`blockRealWhatsappSend`).

## 5. REMARKETING — TEMPLATE

- Existe seletor: `remarketing-workspace.tsx` carrega `listCrmRelationshipTemplates` (só `is_active = true`) — portanto **há** integração com `crm_meta_templates`. Não há digitação livre de nome/corpo na criação.
- O identificador gravado é o `meta_name` (campo `id` da opção), não o UUID: `createRemarketingCampaign` grava snapshot em `remarketing_campaigns` (`template_name`, `template_label`, `template_language`, `template_body`, `template_version`).
- Não existe `template_id`/FK para `crm_meta_templates`. O envio (`runRemarketingEngine`/`sendTemplate`) usa **exclusivamente o snapshot** — nunca relê o cadastro.
- O seletor do Remarketing **não filtra por status aprovado**: aceita qualquer template ativo, inclusive um que a E0 recusaria.

## 6. FILTROS

- Não existe filtro de segmentação. A tela lista campanhas e contatos; o "filtro" existente é apenas o estado da campanha usado para habilitar botões (iniciar/pausar/cancelar) e o status do contato exibido na tabela — visual, no frontend, sobre dados já carregados.
- Não há filtro por origem, etapa do CRM, produto, executivo ou período, nem no frontend nem no backend. A base de contatos vem de colagem de números na criação da campanha.

## 7. RELAÇÃO E0 × TEMPLATES × REMARKETING

Fluxo real:
```text
Meta (aprovação)  →  captura de tela  →  IA  →  crm_meta_templates
                                                   ├─ E0: purpose=primeiro_contato + status aprovado (ignora is_active)
                                                   └─ Remarketing: is_active=true (ignora status e purpose) → snapshot na campanha
```
- Mesma tabela, mesmo cadastro; funções de leitura diferentes, com critérios divergentes.
- Remarketing pode usar template que a E0 recusaria (status não aprovado). E0 pode usar template desativado que o Remarketing não ofereceria.
- Compartilhamento por `purpose` só na E0. Risco de interferência entre fluxos: baixo em execução (Remarketing congela snapshot), mas alto em governança — o mesmo cadastro obedece a duas regras distintas.

## 8. `meta_templates` LEGADO

- Consumidores: apenas `src/lib/comms.functions.ts` (`listTemplates`, `saveTemplate`, `deleteTemplate`) — nenhuma rota ou componente importa essas funções: código morto.
- Demais menções: `src/integrations/supabase/types.ts` (tipos gerados), `backup.server.ts` e `workspace-reset.server.ts` (listas de tabelas).
- 0 registros. Pode ser aposentada sem impacto funcional.

## 9. AMBIENTES

- `crm_meta_templates` não tem coluna de ambiente. Consumidores: apenas a Central de Templates (/f), a E0 (Financeira) e o Remarketing (/f/ln).
- Solar (`/s`) e Seguradora (`/seg`) não consultam a tabela nem possuem Remarketing.
- Conclusão: a ausência de `environment` não é problema operacional hoje.

## 10. DADOS ATUAIS

Todas vazias: `crm_meta_templates` 0, `meta_templates` 0, `remarketing_campaigns` 0, `remarketing_contacts` 0, `remarketing_conversations` 0, `remarketing_messages` 0.

## 11. CAUSA DO PROBLEMA DA HOMOLOGAÇÃO

Falta de cadastro, pura e simples: `crm_meta_templates` está com 0 registros, então `listCrmRelationshipTemplates` devolve lista vazia e o botão de criar campanha fica bloqueado (`disabled ... || !template`). Não é falta de seletor, nem de integração, nem filtro/status incorreto.

## 12. RECOMENDAÇÃO

A Central de Templates já é a fonte oficial: tabela única, cadastro completo, E0 e Remarketing lendo dela. Falta só governança do estado do template.

- Status fechado para aprovação Meta — **B (pequeno ajuste)**: normalizar/limitar valores e usar o mesmo critério nos dois consumidores.
- Conceito de template vigente — **C (construção necessária)**: hoje a E0 escolhe pelo `updated_at` e ignora `is_active`; um cadastro novo troca o template oficial sem intenção.
- Seleção do template no Remarketing — **B**: já existe; falta apenas exigir status aprovado, alinhando com a E0.
- Snapshot da campanha — **A**: já correto e desejável (envio não relê o cadastro).
- Vínculo por ID — **A/B**: hoje grava `meta_name`; um `template_id` opcional só melhora auditoria, não corrige nada.
- Coluna `environment` — **A**: sem uso fora da Financeira.
- Remoção de `meta_templates` + funções em `comms.functions.ts` — **D**: legado morto, 0 registros.

## ORDEM MÍNIMA DE CONSTRUÇÃO

1. Fechar `status` em valores conhecidos (com normalização na gravação).
2. Definir template vigente por finalidade: E0 passa a exigir `is_active = true` + status aprovado, com regra explícita de desempate.
3. Remarketing passa a oferecer somente templates aprovados (mesmo critério da E0).
4. (Opcional) Confirmação antes de excluir template.
5. (Posterior) Remover `meta_templates` e o código morto de `comms.functions.ts`.
