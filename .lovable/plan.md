# Diagnóstico técnico (somente leitura) — Portal Velox

Nada foi alterado. Tudo abaixo vem da leitura do código real.

## 1. Ambientes e isolamento

| Rota | Ambiente | Arquivo |
|---|---|---|
| `/` | Grupo institucional | `src/routes/index.tsx` → `GroupLandingPage` |
| `/financeira` `/solar` `/seguradora` | Institucional por marca | `financeira.tsx` / `solar.tsx` / `seguradora.tsx` → `BrandPage` + `BRANDS` |
| `/f`, `/f/{executivo}`, `/f/executivo/*`, `/f/crm*` | Financeira (Portal + operação) | `f.tsx`, `f.index.tsx`, `f.$slug.tsx`, demais `f.*` |
| `/s` | Solar institucional (formulário) | `s.index.tsx` |
| `/s/portal` | Portal Solar (demonstração visual) | `s.portal.tsx` |
| `/seg`, `/seg/{executivo}` | Seguros institucional | `seg.index.tsx`, `seg.$slug.tsx` (redireciona para `/seg`) |
| `/universo` | Material Institucional (unidade vem de `?u=`) | `universo.tsx` |

Não existe Portal de Seguros (`/seg/portal` não existe).

Compartilhados com risco de impacto cruzado:
- `src/components/portal/investor-portal-home.tsx` — mesmo componente para `/f` e `/s/portal`. Maior risco.
- `src/components/portal/*` (overlays: gateway, estrutura, princípios, revista, telefone, CTA final).
- `src/components/group/brand/brand-page.tsx` + `brand-content.ts` — afeta as 3 páginas institucionais.
- `src/lib/assets/registry.ts` — muda o original de qualquer chave em todos os ambientes.
- `src/lib/portal/asset-overrides.ts` + `.functions.ts` + `src/server/portal/asset-overrides.server.ts`.
- `src/components/journey/*`, `src/lib/journey/engine.ts` (Manual, todas as marcas).

Risco: mexer nesses arquivos atinge `/f` e `/s` juntos; `/seg` só é atingido por `brand-page`/`registry`.

## 2. Portal do Investidor

- Raiz: `InvestorPortalHome` (prop `brandKey` + `homePath`). Home, hero e cards dos 6 módulos estão dentro dele; overlays montam na mesma árvore.
- Material Institucional é rota separada (`/universo`), unidade lida de `?u=`.
- Simulador: `src/components/simulator/simulator-modal.tsx` (lazy). Contato: `portal-final-cta.tsx` + `executive-contact-dialog.tsx`.
- Imagens: arquivos em `src/assets/**`, manifesto `src/lib/assets/registry.ts` (`AssetKey` → `assetUrl`).
- Vínculo imagem↔ponto: `PORTAL_ASSET_SLOTS` (chave estável → `AssetKey` original) e chamada `usePortalAsset(slotKey, original)` no ponto de render.
- Fonte de verdade exibida: `portalAssetUrl()` = edição local pendente → override salvo → original.
- Override no backend: tabela `portal_asset_overrides` (`unit`, `asset_key`, `reference`, único por `unit+asset_key`, RLS só `service_role`; leitura/escrita por server functions com `unit` obrigatório). Fallback = original do registry.
- Já existe arquitetura para editar no próprio local, sem estrutura paralela.

## 3. Editor do Portal

- Componente: `src/components/portal/portal-inline-image-editor.tsx`. Varre o DOM e mostra controle sobre `<img>` cujo `src` bate com um slot conhecido.
- Montado em dois pontos: dentro de `InvestorPortalHome` (filtro: exclui `universo-*`) e em `/universo` (filtro: só `universo-*`). É por isso que ele "só aparece em algumas áreas".
- Abre por `/f?modo=editor` (link em Configurações). `?modo=editor` é reconhecido, mas é apenas pedido.
- Autorização é server-side real: `canEditPortalAssets` (`requireSupabaseAuth` + acesso ao recurso `revista`); gravar/remover chama `assertWorkspaceAccess(context,"revista")`.
- Usuário não autorizado em `/f?modo=editor`: Portal normal, sem nenhum controle.
- Menor alteração para virar modo transversal: montar o mesmo `PortalInlineImageEditor` (sem `slotFilter` restritivo) nos demais pontos de render e acrescentar `usePortalAsset` + entrada em `PORTAL_ASSET_SLOTS` nas imagens ainda fixas. Não exige novo Portal, nova tabela nem nova biblioteca.

## 4. Áreas com imagem — classificação

- A (já editável): Home/capa; 6 capas de módulo; Nossa Estrutura (matriz, recepção, unidade); Princípios; 19 imagens do Material Institucional; capas Solar (usam os mesmos slots com original próprio).
- B (override possível, sem controle visível): nenhum caso confirmado estaticamente; só ocorreria se o `<img>` não estiver no DOM no momento da varredura.
- C (imagem fixa, sem override): fotos institucionais das marcas (`src/assets/brands/*`) usadas por `BrandPage` em `/financeira`, `/solar`, `/seguradora`; imagens internas do Simulador.
- D (outro editor): capa/páginas da Revista (`magazine-overlay.tsx`), que têm pipeline próprio.
- Seguros: não há Portal, então não há área a classificar além da página institucional (C).

Tudo em C pode entrar na infraestrutura atual sem refatoração: basta slot + `usePortalAsset`.

## 5. Editor e navegação multimarcas

- Ambiente é identificado pelo literal que cada rota passa (`brandKey="financeira"` em `f.index.tsx`, `"solar"` em `s.portal.tsx`); `/universo` usa `?u=`.
- Existem três enums paralelos com os mesmos valores: `brandKey` (prop), `PortalBrandKey` (`src/lib/portal-brands.ts`), `BrandKey` (`brand-content.ts`).
- O Editor sabe o ambiente: recebe `unit={brandKey}` e o envia em toda leitura/escrita.
- Isolamento já é real: consulta e gravação sempre filtram por `unit`, com único `(unit, asset_key)`. Um override da Financeira não aparece na Solar.
- Menor alteração arquitetural: unificar os três enums em um só tipo e passar `unit` também nas áreas institucionais — nada além disso.

## 6. Link cru — identidade

- Matching: server function `resolvePortalIdentity` → RPC SQL `resolve_portal_identity`.
- Campos: telefone normalizado (11 dígitos) e e-mail normalizado, buscados **separadamente**; prioridade telefone, depois e-mail. Divergência entre os dois é marcada como conflito, sem fusão.
- Nome nunca entra no matching; nome diferente vira "alternativa" e não impede reconhecimento.
- Duplicata: bloqueada por advisory lock + unicidade de `identity_key`.
- `investorId` oficial = `portal_leads.id`. Responsável oficial = `portal_leads.responsible_executive_id/slug`.
- Link cru e link personalizado usam o **mesmo** resolver; só mudam parâmetros.
- Dependência de navegador: sessão em `localStorage` (`velox:portal:session:v1`) e slug em `atlas:manual:responsibleExecutiveSlug`.
- `ensurePortalToken()` **ainda depende** de `loadLeads()` (cache local) mesmo com `investorId` já reconhecido; só cai na sessão se o cache não tiver o lead.
- Menor correção: inverter a ordem em `src/lib/portal-token.ts` — usar a sessão oficial primeiro, `loadLeads()` só como último recurso.

## 7. CTA "Fale com o especialista"

- Resolve por `getSessionResponsibleExecutive()` (`src/lib/portal/session-responsible.ts`).
- Ordem atual: primeiro `getResponsibleExecutive()` (slug do `localStorage`/URL); só depois o responsável oficial da sessão. Ou seja, dado do navegador pode vencer o responsável oficial.
- Genérico: `whatsapp-floating.tsx` cai em modal com `getDefaultExecutive()` quando não há personalização.
- "Cadastre-se novamente" corresponde aos retornos `identity_unresolved`/`identity_invalid` — telefone e e-mail que não normalizam, ou erro transitório; não é causado por nome divergente.
- Menor correção: inverter a precedência para o responsável oficial da sessão vir antes do slug do navegador.

## 8. Jornada e percentual

- Percentual é calculado no cliente em `src/lib/journey/engine.ts` (`velox:journey:v1` no `localStorage`); há ainda um segundo store local só do Manual (`velox:manual:v1`).
- Servidor recebe espelho via `pushPortalProgress` → `portal_journey_events` / `portal_engagement`; o Workspace lê a fonte server-side.
- Outro navegador **não** mantém o mesmo percentual: sem registro local, o engine recalcula a partir do evento atual em vez de ler o acumulado do servidor.
- Eventos ficam vinculados ao `investorId` oficial (evento sem `investorId` não persiste).
- Menor correção: ler o progresso já persistido no servidor antes do recálculo local.

## 9. Formulário institucional (`/`)

- `src/components/group/unit-interest-form.tsx` → server fn `registrarInteresseUnidade`.
- Grava em `group_unit_leads` (+ `group_unit_lead_events`); marca no campo `unit` (`financeira|solar|seguros`), origem em `origin`/`campaign`/`from_group`.
- Financeira/Solar/Seguros são diferenciadas apenas pelo valor de `unit`.
- Responsável inicial **não é definido**: nasce sem responsável, `first_contact_status = pendente`; atribuição é manual via `atribuirResponsavelUnidade`.
- Por que "não chega ao Workspace": é por desenho. O Workspace/CRM lê `portal_leads`/`crm_leads`; `group_unit_leads` só é lido pela tela de carteira de unidades (`listarInteressadosUnidade`, com `assertUnitPortfolioAccess`). Não é falha de gravação nem de RLS.
- Menor correção: decidir entre (a) exibir `group_unit_leads` também na visão do Workspace, ou (b) atribuir responsável automaticamente na criação. É decisão de negócio, não correção de bug.

## 10. Thiago — colaborador híbrido

- Permissão vem de: `ROLE_MATRIX` (`src/lib/workspace-authorization.ts`), módulos em `workspace_module_permissions` (`crm`, `portal_leads`, `e0_automatico`) e a lista `HYBRID_WORKSPACE_USER_IDS = ["usr_thiago"]` (`src/lib/portal-workspace.ts`).
- Escopos dele: `green_sales`, `redistribuicao`, `portal`, `tiktok`, `meta` — mesmo conjunto do `super_admin`, sem ser admin.
- Solar/Seguros: `assertUnitPortfolioAccess` já libera o híbrido; basta atribuir `group_unit_leads.responsible_executive_id` a ele.
- Limitação encontrada: lead de unidade nasce sem responsável (nada roteia para o Thiago automaticamente); e `getPortalAdministratorId()` decide o dono do Portal lendo cache do navegador (`atlas:users:v3`), caindo em `usr_thiago` só como fallback.
- A estrutura atual é suficiente; não é preciso matriz nova nem tornar Thiago administrador.

## 11–13. Ação do Dia, compromissos e próxima ação

- `buildDailyActions()` (`src/server/crm/daily-actions.server.ts`) só agrega: `portal_meetings`, `workspace_agenda_events`, `relationship_queue` (V2, fonte real de ligações/mensagens), deveres de encerramento e avisos do Portal. A fila legada `crm_cadence_tasks` está aposentada (retorna vazio) e `workspace_e0_actions` só serve de histórico.
- Prioridade: `actionRank()` em `src/lib/crm/daily-actions.ts` — reivindicado 0; aviso 0,5; compromisso prioritário em `agora`/`atrasada` 0; primeiro contato/E0 2; atrasada 3; hoje/agora 4; futura 6; pendente 7. Ordenação final por `sortDailyActions()`.
- Posição 1 e claim: `currentDailyAction()` (`daily-actions-gate.server.ts`) reivindica de forma atômica (`PENDING → PROCESSING`); toda mutação revalida a ação corrente no servidor.
- Compromissos: `resolveBucket()` marca `agora` na janela de 5 minutos e, passada essa janela sem desfecho, cai para `pendente` — que tem rank 7 e sai da seleção automática. É exatamente o sintoma "vira pendência com só Abrir".
  - Menor correção: promover a virada `futura → agora` no momento certo (reclassificar logo após concluir a posição 1, além do timer de 30 s do overlay). O rank já é 0 quando entra em `agora`, e um item reivindicado nunca é interrompido — a regra de negócio é preservada sem mexer no rank.
- "Próximo compromisso" (`next-commitment-alert.tsx`) é informativo, lê outra fonte (`listNextCommitments`) e não é a mesma coisa que a ação operacional.
- Próxima ação do mesmo lead: o servidor **já** cria e devolve a Mensagem E0 na mesma resposta (`registerQueueCallOutcome` roda `tickLead` antes de responder e `queueAfterOutcome` devolve a fila atualizada). O atraso é do frontend: `completeWithStability` em `daily-actions-overlay.tsx` descarta `result.queue`, espera 4 s fixos e refaz a leitura completa.
  - Menor correção: consumir `result.queue` imediatamente (como já faz o outro caminho de conclusão) e usar a releitura só como fallback.

## 14. Avisos do Portal

- Calculados na hora a partir de `portal_journey_events` (`portal-activity-alerts.server.ts`); não há tabela de aviso.
- Primeiro acesso sempre gera aviso; retorno conta só com intervalo ≥ 7 dias; dedup pela chave `portal_alert:<leadId>:<timestamp>`.
- "Concluído" grava em `relationship_engine_log` — idempotência é só de aplicação (conjunto em memória), sem restrição única no banco.
- Janela de visibilidade: 7 dias. Sim, o aviso pode sumir sem ser concluído.
- Entra com `bucket: alerta`, rank 0,5, nunca é agrupado com o lead nem vira ação corrente — não interfere na ação comercial.

## 15. Simulador (layout)

- Barra inferior e "Calcular potencial": `SimulatorFooter` dentro de `simulator-modal.tsx` (modal em `z-[75]`).
- Botão flutuante "Solicitar Atendimento": `src/components/shared/whatsapp-floating.tsx`, `fixed bottom-6 right-6 z-[85]` — fica acima do modal e não sabe que o Simulador está aberto.
- Não há reserva de área segura inferior. A sobreposição aparece principalmente abaixo de 768 px.
- Menor alteração: esconder o flutuante enquanto o Simulador estiver aberto (mesmo padrão já usado para revista/iframe) ou adicionar espaçamento inferior no rodapé do modal em telas pequenas. Só CSS/renderização condicional.

## 16. Configurações × Central de Homologação

- O item "Editor do Portal do Investidor" é `PortalEditorSection()` em `src/routes/f.executivo.configuracoes.tsx`; é apenas um link para `/f?modo=editor`.
- A Central de Homologação (`/f/executivo/homologacao`) é outra coisa: retrato somente leitura do motor, sem edição.
- Mover o item de lugar não afeta lógica alguma (a permissão é decidida no servidor ao abrir `/f`). Menor alteração: recortar o bloco JSX para a outra tela.

## 17. Fontes de verdade

| Informação | Fonte | Escrita | Consumidores |
|---|---|---|---|
| Identidade do investidor | `resolve_portal_identity` / `portal_leads` | server fn | Portal, CRM, Jornada |
| Responsável | `portal_leads.responsible_executive_id` **e** `group_unit_leads.responsible_executive_id` | ownership / atribuição de unidade | CRM, E0, CTA |
| Lead | `portal_leads`, `crm_leads`; unidades em `group_unit_leads` | intake/sync | Workspace, cadência |
| Compromisso | `portal_meetings`, `workspace_agenda_events` | sync GreenSales / agenda | Ação do Dia, alertas |
| Follow-up | `portal_meetings.follow_up_state` | sync GreenSales | Timeline, Ação do Dia |
| Cadência | `relationship_cadences` + `relationship_queue` | motor | Ação do Dia |
| Mensagem E0 | `relationship_queue` (pendente) + `crm_messages`/`relationship_message_sends` (enviada) | motor | Ação do Dia, Jornada |
| Jornada / percentual | servidor: `portal_journey_events`, `portal_engagement`; cliente: `velox:journey:v1` | ambos | Workspace (servidor), Portal (local) |
| Evento do Portal | `portal_journey_events` | Portal | Jornada, avisos |
| Aviso | derivado de eventos; conclusão em `relationship_engine_log` | conclusão | Ação do Dia |
| Origem | campo textual por tabela, **não centralizado** | intake | relatórios |
| Marca | `src/config/workspace.ts` + enums de marca | código | UI |
| Permissões | `user_roles`, `workspace_module_permissions`, `HYBRID_WORKSPACE_USER_IDS` | admin | rotas e server fns |
| Imagens / overrides | `src/lib/assets/registry.ts` + `portal_asset_overrides` | Editor | Portal, `/universo` |

Divergências reais: responsável em duas tabelas sem visão comum; jornada com fonte local e server-side; dono do Portal decidido por cache do navegador; três enums de marca paralelos; CTA usando navegador em vez do responsável oficial.

## 18. Configuração antiga × V2

- `config.ts` — catálogo único de etapas e prazos (E0…E30). `decide.ts` decide **qual etapa macro** vence, usando dias úteis.
- `cadence-v2.ts` / `cadence-v2-decide.ts` — decidem a **ordem interna** da etapa (ligação 1 → 10 min → ligação 2 → mensagem) e janelas.
- `flow-plan.ts` + `flow-versions.server.ts` — congelam a sequência por ciclo.
- `step-registry.ts` — une as chaves das duas fontes para validar execução.
- Em produção rodam **as duas camadas juntas**, compostas em `engine.ts`; não são alternativas. Código morto: `buildCadenceQueue` (retorna vazio) e o cartão de `workspace_e0_actions`.
- Risco: mexer em `config.ts` afeta decisão, validação e ciclos históricos ao mesmo tempo; mexer só em `cadence-v2-decide.ts` é isolado e seguro.

## 19. Resultado final

**A) Problemas confirmados**
1. CTA do especialista prioriza dado do navegador sobre o responsável oficial.
2. `ensurePortalToken()` depende de `loadLeads()` mesmo com investidor reconhecido.
3. Percentual da Jornada não é recuperado do servidor em outro aparelho.
4. Compromisso passa a `pendente` (rank 7) 5 min depois do início e sai da seleção automática.
5. Atraso de 10–15 s na próxima ação do mesmo lead: o frontend descarta a fila já devolvida.
6. Botão flutuante sobrepõe o rodapé do Simulador em telas estreitas.
7. Aviso do Portal some após 7 dias sem conclusão; idempotência só de aplicação.
8. Imagens institucionais das marcas não têm slot de override.
9. Editor só monta em dois pontos, por isso não é transversal.
10. Dono do Portal decidido por cache de navegador.

**B) Corrigido — não mexer:** matching de identidade (telefone → e-mail, nome nunca bloqueia, sem duplicata); autorização server-side do Editor; isolamento por `unit` nos overrides; claims atômicos e posição 1; aviso do Portal fora da fila comercial; criação da Mensagem E0 no servidor.

**C) Não comprovado:** duração exata da janela de 10–15 s (inferida do código); linha real de permissões do Thiago no banco; classificação "B" de imagens (depende do DOM em execução); origem de `raw_payload.follow_up`.

**D–F) Arquivos, funções e tabelas:** listados em cada seção acima.

**G) Dependências entre módulos:** `investor-portal-home` serve `/f` e `/s/portal`; `registry.ts` serve todos; `config.ts` serve decisão, registro de etapas e planos congelados; Ação do Dia depende de `relationship_queue`, `portal_meetings` e `portal_journey_events`.

**H) Menor correção por problema:** descrita ao final de cada seção.

**I) Risco em `/f`, `/s`, `/seg`:**
- Editor/imagens e Portal: atinge `/f` e `/s`; `/seg` só se `brand-page`/`registry` forem tocados.
- Identidade, CTA, Jornada, Ação do Dia, compromissos, Simulador: hoje só afetam `/f` (e `/s/portal` no caso de CTA e Simulador, por serem componentes comuns).
- Formulário institucional e permissões: afetam os três, pois usam `group_unit_leads`.

**J) Ordem recomendada:** 1) fila imediata da próxima ação (item 5); 2) promoção do compromisso na janela (4); 3) CTA do especialista (1); 4) token sem `loadLeads()` (2); 5) sobreposição do Simulador (6); 6) percentual server-side (3); 7) Editor transversal + slots faltantes (8, 9); 8) roteamento/atribuição do formulário institucional (seção 9); 9) retenção e idempotência do aviso (7); 10) dono do Portal e unificação de enums (10).

**K) Testes após construir:** conclusão de ligação 2 devolvendo a Mensagem E0 sem releitura; compromisso entrando em janela após a posição 1; link cru com e-mail/WhatsApp oficiais e nome diferente preservando responsável; token emitido sem cache local; jornada em segundo aparelho; Editor autorizado e não autorizado em `/f?modo=editor`; override da Financeira invisível em `/s/portal`; Simulador em 360/768/1280 px; aviso concluído não reaparecendo; lead institucional por marca chegando à carteira certa; e a suíte já existente de cadência/Ação do Dia sem regressão.
