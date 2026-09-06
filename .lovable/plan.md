# Relatório forense de código legado — Workspace Financeira /f

Somente leitura. Nada foi alterado, apagado, renomeado ou migrado.

## Arquitetura atual considerada (base da análise)

`src/routes/f.executivo.tsx` → `OperationalGuard` → `ExecutiveShellFrame` → `Outlet` → página, com `<ExecutiveShell title fullBleed>` atuando apenas como declaração de título/tela cheia. Autorização em três camadas legítimas: `assertWorkspaceAccess`/`autorizacaoWorkspace` (recursos do menu), `useModuleAccess` (módulos operacionais: CRM, Portal dos Leads, Backups) e RLS no banco. Identidade: Supabase Auth → `executive_profiles` → `user_roles`. Motor: `relationship_queue` + versões de fluxo + Biblioteca de Conteúdos. Titularidade: `portal_leads.responsible_executive_id`.

---

## 🔴 GRUPO A — CANDIDATOS FORTES A REMOÇÃO

Todos com verificação de import direto, import dinâmico e busca por nome em todo `src`.

| # | Arquivo | O que é | Evidência | Risco |
|---|---|---|---|---|
| A1 | `src/hooks/use-administrative-access.ts` | Hook que decidiria acesso à Apresentação Digital | Zero consumidores. A rota chama `permissaoApresentacao` direto e é protegida por `WorkspaceResourceGuard resource="apresentacao_digital"` | BAIXO |
| A2 | `src/lib/knowledge-base.ts` (466 linhas) | Acervo de documentos com estado local (listDocuments/addDocument, rótulos) | Zero referências ao módulo em todo `src`; a Central de Conhecimento atual não o importa | BAIXO |
| A3 | `src/lib/notifications.ts` (124 linhas) | Fila de notificações client-side (`ensureNotificationsSubscribed`, `markAllRead`…) | Zero referências; a Central de Alertas usa fonte própria | BAIXO |
| A4 | `src/lib/report-generators.ts` (311 linhas) | `exportReportPdf` / `exportReportExcel` | Zero referências; a rota `/f/executivo/relatorios` virou redirect para o Brain | BAIXO |
| A5 | `src/lib/relationship.functions.ts` | `getRelationshipEngineStatus`, `getRelationshipTimeline` | Zero chamadores; o motor é lido por `src/lib/relationship/*.functions.ts` | BAIXO |
| A6 | `src/lib/executive-video.functions.ts` | `uploadPostPresentationVideo` | Zero chamadores desde a remoção da seção "Vídeo de pós-apresentação" da ficha do executivo | BAIXO |
| A7 | `src/components/executive/pendings-card.tsx` | Card de pendências | Zero consumidores | BAIXO |
| A8 | `src/components/executive/brain/chart-card.tsx` | Cartão de gráfico do Brain | Zero consumidores; o Brain atual não o importa | BAIXO |
| A9 | `src/components/executive/reports/infographic-dashboard.tsx` | Painel infográfico de relatórios | Zero consumidores (par do A4) | BAIXO |
| A10 | `src/components/crm/crm-lead-journey.tsx` | Jornada do lead no CRM | Zero consumidores; a ficha usa `crm-lead-ficha` | BAIXO |

Também sem chamador, porém com risco MÉDIO por serem portas de entrada de funções de servidor que podem ser reativadas por operação administrativa: `src/lib/campaign-ai.functions.ts` (`generateCampaignDraft`), `src/lib/crm/historical-import.functions.ts` (`runHistoricalImport`), `src/lib/google-mail.functions.ts` (`sendGoogleMail`). O código de servidor correspondente continua existindo; antes de remover, confirmar se alguma rotina administrativa depende deles.

---

## 🟠 GRUPO B — LEGADO PROVÁVEL, PRECISA CONFIRMAÇÃO

**B1 — Páginas sem nenhum caminho de acesso pela interface.** Rotas existentes, funcionais, mas sem link em nenhum lugar do produto (apenas alcançáveis digitando a URL):

- `/f/executivo/templates` (658 linhas) — o próprio menu documenta: "Central de Templates saiu do menu: os templates da Meta são geridos pela Biblioteca oficial e pelo Motor". É o caso mais claro de página substituída.
- `/f/executivo/administracao` (440 linhas) e `/f/executivo/recursos` (298 linhas) — Recursos só é linkado por Administração, e Administração não é linkada por ninguém: as duas formam uma ilha fechada. Recursos usa `src/lib/resources` e `src/lib/governance`, mecanismos anteriores à autorização server-side atual.
- `/f/executivo/investidores` e `/f/executivo/investidores/$id` (153 linhas + ficha) — sem link; a ficha do investidor hoje é aberta pelo CRM/Ação do Dia.
- `/f/executivo/fluxos` (67 linhas) — administração de versões de fluxo, sem link no menu.
- `/f/executivo/identidade` (151 linhas) — fila de pendências de identidade, sem link no menu.

Dúvida: algumas dessas telas podem ser acessos administrativos deliberados por URL (o mesmo padrão já documentado em "Unidades do Grupo"). Precisam de confirmação sua, uma a uma, antes de qualquer remoção. Risco: BAIXO para Templates, MÉDIO para as demais.

**B2 — Duas rotas para a titularidade.** `src/server/crm/responsible.server.ts` + `ownership.server.ts` resolvem responsável a partir do vendedor GreenSales (cadeia real: `lead-sync` → `lead-intake` → `ownership`), enquanto vários outros pontos leem/gravam `responsible_executive_id` diretamente. Não é código morto — é dívida de dois caminhos coexistindo. Risco: MÉDIO. Nenhuma unificação proposta aqui.

**B3 — Duas filas.** `first-contact-queue.server.ts` (entrada/primeiro contato) e `relationship_queue` (execução do motor) convivem, com `crm/cadence.server.ts` escrevendo nos dois. Funcionalmente é entrada → execução, não duplicata; a atenção é a possibilidade de divergência em falha parcial de sync. Risco: MÉDIO.

**B4 — Ramo "workspace" de `src/lib/navigation-environment.ts`.** O arquivo é consumido por `manual/concluido`, `error-page`, `journey-chrome` e `module-chrome` — nenhum deles no ramo `/f/executivo`. O caso `"workspace"` → `/f/executivo/home` existe mas nunca é exercitado pelo Workspace, que navega por `unitPath` + `Link`. O arquivo como um todo é usado por outros ambientes: MANTER o arquivo; só o ramo é possivelmente ocioso. Risco: BAIXO isoladamente, MÉDIO se alguém apagar o arquivo.

**B5 — `/f/executivo/greensales` e `/f/executivo/greensales-sync`.** Só `greensales-sync` aparece em `src/config/modules.ts`; a página `greensales` não tem link. Precisa confirmar se ainda cumpre função administrativa. Risco: MÉDIO.

---

## 🟡 GRUPO C — ANTIGO, MAS AINDA NECESSÁRIO

- **30 rotas `src/routes/executivo.*.tsx`** (sem o prefixo `/f`) — são apenas `redirect` para `/f/executivo/...`, preservando links e favoritos anteriores à criação da unidade de negócio. Preservam `search`, sem lógica duplicada. MANTER enquanto houver links antigos publicados. Risco de remoção: MÉDIO (quebra URLs antigas).
- **`/f/executivo/relatorios` e `/f/executivo/acao-do-dia-demo`** — redirects internos (Brain Analytics e Central de Homologação). Mesma lógica: baratos e protegem links salvos.
- **`/f/executivo/unidades`** — carteira institucional do Grupo; a remoção foi só do menu, documentada em comentário. A rota, os dados e os formulários seguem em uso.
- **`SEED_USERS` em `src/lib/executive-auth.ts`** — hoje ainda é o fallback de bootstrap do diretório/login quando o servidor não devolve perfis; o servidor sobrescreve quando há dado real. Não é mock de demonstração solto. Observação: contém credenciais em texto no código-fonte — ponto para uma investigação própria, fora deste escopo.
- **Demonstração da Ação do Dia** (`src/lib/crm/daily-actions.demo.ts` + `homologation-daily-actions-demo.tsx` + `/f/executivo/homologacao/acao-do-dia`) — adaptador 100% em memória, sem Supabase e sem WhatsApp, dentro da Central de Homologação e sob o guard de sessão do layout `/f/executivo`. Não interfere em produção.
- **`/f/executivo/teste-cadencia` e `/f/executivo/laboratorio`** — ambientes de teste com leads fictícios forçados a simulação; o Laboratório só aparece no menu em ambiente de homologação. São ferramentas vivas, não sobras.

---

## 🟢 GRUPO D — NÃO TOCAR

Shell atual (`ExecutiveShellFrame` + adaptador `ExecutiveShell`, incluindo o caminho de compatibilidade quando não há frame — usado por ambientes fora de `/f/executivo`); `OperationalGuard`; `WorkspaceResourceGuard`; `assertWorkspaceAccess`/`autorizacaoWorkspace`; `use-workspace-permissions` e `use-workspace-authorization` (funções distintas, sem sobreposição real); RLS; identidade server-truth; E0; `relationship_queue`, versões de fluxo e Biblioteca de Conteúdos (camadas `message-library` → `step-message` → `e0-template` são hierarquia, não duplicata); CRM; GreenSales; Portal dos Leads; Central de Operações; KPI; Campanhas; Safety Lock do WhatsApp (`whatsapp.server` → `crm/messaging` → `dispatch` é cadeia única, sem caminho paralelo de envio); Central de Backup e Backup de Conversas (módulos diferentes, fontes diferentes); isolamento de `/`, `/s`, `/s/portal`, `/seg`.

---

## Resultado final

1. **Candidatos fortes:** 10 (mais 3 de risco médio).
2. **Candidatos prováveis:** 5 famílias (B1 a B5), sendo B1 com 6 páginas.
3. **Falsos positivos importantes evitados:** as 30 rotas `/executivo/*` (parecem duplicatas, são redirects), os três hooks de permissão (parecem duplicados, têm papéis distintos), `message-library`/`step-message`/`e0-template` (camadas), `backups` vs `central-backup` (módulos distintos), `SEED_USERS` (fallback de bootstrap ativo).
4. **Famílias de legado encontradas:** (a) módulos client-side de uma era anterior ao server-truth — conhecimento, notificações, relatórios, recursos/governança; (b) portas de função de servidor sem chamador; (c) componentes visuais órfãos; (d) páginas administrativas que perderam o link; (e) redirects históricos (legítimos).
5. **Resíduos por área:** SEED_USERS — presente e **ainda usado**; mocks — só o adaptador de demonstração isolado na Homologação; fallback de identidade — apenas o SEED_USERS; navegação antiga — só o ramo "workspace" ocioso; shell antigo — **nenhum resíduo**, a área ficou limpa após a correção; CRM antigo — dois caminhos de titularidade (não morto); GreenSales antigo — página `greensales` sem link; motor antigo — nenhum arquivo órfão; WhatsApp antigo — nenhum caminho de envio paralelo; backup antigo — nenhum, só o shim de URL.
6. **As 5 limpezas mais seguras (se um dia autorizadas):** A1, A2, A3, A4+A9 juntos, A7+A8+A10.
7. **Não recomendo tocar:** Grupo D inteiro, os redirects do Grupo C e `SEED_USERS`.
8. **Exigem segunda investigação antes de qualquer remoção:** as 6 páginas de B1 (uma a uma), `campaign-ai`/`historical-import`/`google-mail`, a dupla de titularidade B2 e as duas filas B3.
