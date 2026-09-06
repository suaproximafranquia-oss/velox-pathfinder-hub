# Relatório de confirmação — candidatos a remoção (Workspace Financeira /f)

Somente leitura. Nada foi alterado, apagado, renomeado ou movido.

## Como cada candidato foi verificado

Para os 13 arquivos foram feitas buscas por: caminho e nome do arquivo, nome do componente/hook, **cada símbolo exportado individualmente** (funções, tipos, constantes), `import()` dinâmico, `lazy(`, barrels/reexports, `package.json` e configurações, arquivos de rota, testes e material de homologação/laboratório.

Fatos gerais confirmados:

- **Barrels existentes no projeto:** apenas `src/components/site/v2/index.ts` e `src/lib/relationship/index.ts`. Nenhum dos candidatos é reexportado por eles (o barrel do motor exporta só arquivos de `src/lib/relationship/`, e o candidato A5 está em `src/lib/relationship.functions.ts`, fora dessa pasta).
- **Registro automático de `*.functions.ts`: NÃO EXISTE.** No TanStack Start um `createServerFn` só vira endpoint se o módulo entrar no grafo de build — ou seja, apenas se algo importar o arquivo. A árvore de rotas é gerada exclusivamente a partir de `src/routes/`; não há auto-discovery, registry, glob ou convenção que exponha um `.functions.ts` sem import. O `vite.config.ts` não lista módulos manualmente. Portanto **um `.functions.ts` sem importador não tem endpoint publicado**.
- **Nenhuma referência a qualquer candidato** em `package.json`, configs, scripts, seeds, bootstrap, homologação, laboratório, teste de cadência ou demonstrações.

## Tabela 1 — os 10 candidatos fortes

| ID | Arquivo | Consumidor direto | Indireto/reexport | Dinâmico | Rota | Teste/Dev | Dependência | Conclusão | Confiança |
|---|---|---|---|---|---|---|---|---|---|
| A1 | `src/hooks/use-administrative-access.ts` | nenhum | nenhum | não | nenhuma | não | importa `presentation.functions` (tem outros consumidores) | REMOÇÃO SEGURA | MUITO ALTA |
| A2 | `src/lib/knowledge-base.ts` | nenhum | nenhum | não (ele é que faz import dinâmico de mammoth/pdfjs/tesseract) | nenhuma | não | nenhuma | REMOÇÃO SEGURA | MUITO ALTA |
| A3 | `src/lib/notifications.ts` | nenhum | nenhum | não | nenhuma | não | consome `events/bus` (usado por outros) | REMOÇÃO SEGURA | MUITO ALTA |
| A4 | `src/lib/report-generators.ts` | nenhum | nenhum | não | nenhuma | não | importa `reports`, `report-comparatives`, `kpi-manager`, `painel-campanhas` | REMOÇÃO SEGURA | ALTA |
| A5 | `src/lib/relationship.functions.ts` | nenhum | não está no barrel do motor | não | nenhuma | não | usa `audit.server` (tem outros consumidores) | REMOÇÃO SEGURA | MUITO ALTA |
| A6 | `src/lib/executive-video.functions.ts` | nenhum | nenhum | não | nenhuma | não | nenhuma | REMOÇÃO SEGURA | MUITO ALTA |
| A7 | `src/components/executive/pendings-card.tsx` | nenhum | nenhum | não | nenhuma | `investor-profile.test.ts` mocka `@/lib/pendings`, **não** o card | consome `lib/pendings` (também usado por `investor-profile.ts`) | REMOÇÃO SEGURA | MUITO ALTA |
| A8 | `src/components/executive/brain/chart-card.tsx` | nenhum | nenhum | não | Brain monta `kpi-card`, `funnel-card`, `executive-ai-dialog` — **não** este | não | consome `brain-data` (usado pelos outros cards) | REMOÇÃO SEGURA | MUITO ALTA |
| A9 | `src/components/executive/reports/infographic-dashboard.tsx` | nenhum | nenhum | não | nenhuma | não | é o **único** consumidor de `@/lib/reports` | REMOÇÃO SEGURA | MUITO ALTA |
| A10 | `src/components/crm/crm-lead-journey.tsx` | nenhum | nenhum | não | nenhuma | não | usa `library.functions` (com outros consumidores) e `crm-conversation` | REMOÇÃO SEGURA | MUITO ALTA |

**Dependência entre os candidatos:** nenhuma. Nenhum dos 10 importa outro dos 10 — não há cadeia A→B→C entre eles. Todas as dependências apontam para módulos de terceiros ou para libs que continuam tendo outros consumidores.

**Efeito cascata detectado (informativo, não proponho remover agora):** removidos A4 e A9, ficam sem qualquer consumidor `src/lib/reports.ts` e `src/lib/report-comparatives.ts`; e as bibliotecas `jspdf`, `xlsx` (A4) e `mammoth`, `pdfjs-dist`, `tesseract.js` (A2) perderiam seu único uso. Verifique `src/lib/investor-report.ts` antes de mexer em dependências de PDF: ele é vivo (usado por `investidores` e pela ficha do investidor) e pode compartilhar bibliotecas.

## Tabela 2 — as 3 funções de servidor

| ID | Arquivo | Função | Chamador | Exposição automática | Endpoint/rota | Uso admin | Uso dev | Conclusão | Confiança |
|---|---|---|---|---|---|---|---|---|---|
| B-M1 | `src/lib/campaign-ai.functions.ts` | `generateCampaignDraft` | nenhum (nem `generateCampaignDraft` nem o tipo `CampaignDraft` aparecem em `src`) | não existe no projeto | nenhum — sem import, não entra no grafo | nenhum encontrado | nenhum | A) definitivamente morta — REMOÇÃO SEGURA | ALTA |
| B-M2 | `src/lib/crm/historical-import.functions.ts` | `runHistoricalImport` | nenhum | não existe | nenhum | nenhuma tela dispara | nenhum | B) provavelmente morta — REMOÇÃO PROVAVELMENTE SEGURA | MÉDIA-ALTA |
| B-M3 | `src/lib/google-mail.functions.ts` | `sendGoogleMail` | nenhum | não existe | nenhum | nenhum | nenhum | B) provavelmente morta — REMOÇÃO PROVAVELMENTE SEGURA | MÉDIA-ALTA |

Detalhe importante: `src/server/crm/historical-import.server.ts` e `src/server/google-mail.server.ts` têm como **único** consumidor esses dois `.functions.ts`. Ou seja, são cadeias inteiras sem porta de entrada. Mantive-as em "provavelmente segura" e não em "segura" por um único motivo: a carga histórica de leads e o envio de e-mail pela conta Google conectada são capacidades operacionais que podem ter sido construídas para uso pontual futuro. Isso é uma decisão sua de produto, não uma incerteza técnica — tecnicamente não há como executá-las hoje.

## Homologação, laboratório e desenvolvimento

Nenhum dos 13 candidatos aparece na Central de Homologação, no Laboratório Atlas, no teste de cadência, no adaptador de demonstração da Ação do Dia, em fixtures, mocks ou seeds. O único teste que chega perto é `src/lib/investor-profile.test.ts`, que mocka `@/lib/pendings` — biblioteca que **permanece** viva por causa de `investor-profile.ts`; o teste não conhece o card A7.

## Veredito sobre limpeza em lote

**SIM, MAS** — dividir em três lotes é mais seguro, para que qualquer regressão fique óbvia:

- **Lote 1 — componentes órfãos:** A7, A8, A9, A10. Sem efeito colateral fora de si mesmos (com a ressalva de que A9 deixa `src/lib/reports.ts` sem consumidor).
- **Lote 2 — bibliotecas e hook órfãos:** A1, A2, A3, A5, A6. Também isolados; A4 pode entrar aqui, mas prefiro tratá-lo junto de A9 por causa da cadeia de relatórios.
- **Lote 3 — funções de servidor:** B-M1 imediatamente; B-M2 e B-M3 só após você confirmar que a carga histórica e o e-mail pelo Google não serão retomados.

Entre os lotes, o critério de sucesso é apenas estrutural: tipos e build passando e as telas do `/f` abrindo.

## "Parece legado, mas não é" — proteger de qualquer limpeza automática

- As 30 rotas `src/routes/executivo.*.tsx` — redirects que preservam URLs antigas.
- `/f/executivo/relatorios` e `/f/executivo/acao-do-dia-demo` — redirects internos.
- `src/lib/investor-report.ts` e `investor-report-lazy.ts` — vivos (relatório do investidor sob demanda).
- `src/lib/pendings.ts`, `src/lib/kpi-manager.ts`, `src/lib/brain-data.ts`, `src/lib/events/bus.ts` — continuam com consumidores reais mesmo após a remoção dos candidatos.
- `SEED_USERS` em `src/lib/executive-auth.ts` — fallback de bootstrap ativo.
- Adaptador de demonstração da Ação do Dia e o Laboratório — ferramentas de homologação vivas.
- `src/lib/navigation-environment.ts` — usado por outros ambientes.
- `ExecutiveShell` / `ExecutiveShellFrame`, guards, autorização, motor, CRM, GreenSales, Portal dos Leads, Central de Operações, KPI, Campanhas, Safety Lock.

## Resposta direta à pergunta central

Se os 10 candidatos fortes fossem apagados hoje, **não há caminho técnico conhecido** — import estático, import dinâmico, reexport, barrel, rota, loader, endpoint gerado, teste ou ferramenta de homologação — pelo qual alguma funcionalidade existente do `/f` fosse executá-los. Para B-M1 vale a mesma conclusão. Para B-M2 e B-M3 a conclusão técnica é idêntica, mas envolve capacidades de negócio (carga histórica e e-mail Google) que merecem sua confirmação antes de sumirem do repositório.
