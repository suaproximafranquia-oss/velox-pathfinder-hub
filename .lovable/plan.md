# Plano final — Correção do estado NOVO no Workspace

## Decisões confirmadas

1. **Gestora: SIM.** Pode marcar como visualizado e encerrar leads que já enxerga, restrito a `viewed_at`, `closed_at` e `notes`. Nenhum acesso de escrita a identidade, proprietário, escopo ou dados comerciais.
2. **GreenSales: NÃO.** Alteração feita pela equipe no GreenSales é sincronização administrativa e nunca reclassifica o lead como NOVO.
3. **WhatsApp: SIM.** Resposta do investidor é atividade real e entra no cálculo de `lastActivity`.

## Regra final

- `closed_at` preenchido -> ENCERRADO
- `viewed_at` vazio -> NOVO
- atividade real do investidor posterior ao `viewed_at` -> NOVO novamente
- caso contrário -> EM ANDAMENTO

Atividade real do investidor: entrada/cadastro, retorno reconhecido pelo Portal, progresso na jornada (`journey_last_event_at`), simulador, IA, clique/acesso a recurso e **resposta no WhatsApp (`last_inbound_at`)**.
Nunca é atividade: abrir ficha, abrir conversa, redistribuir, transferir proprietário, editar cadastro, sincronizar GreenSales, polling, refresh, evento técnico.

## Correções

**1. Ações administrativas param de escrever atividade**
- `src/lib/portal-leads.functions.ts`: remover `last_activity_at` de `redistributePortalLead` (linha 311) e `assignPortalLeadOwner` (linha 335). O horário da operação continua em auditoria/evento administrativo.
- Mesmo arquivo, ramos de dedupe (linha 152) e de escopo `redistribuicao` (linha 182): aplicar a mesma trava do ramo principal — atividade só avança quando o cliente informa `lastActivityAt`, nunca `now()` por padrão, e nunca retrocede.

**2. Sincronização GreenSales deixa de reclassificar**
- `src/server/crm/workspace-card.server.ts` (linha 70) e `src/lib/greensales-sync.functions.ts` (linha 135): usar o timestamp externo apenas na criação do card; em atualizações posteriores, não avançar `last_activity_at` a partir de `updated_at` externo.

**3. Resposta do WhatsApp passa a contar**
- `src/lib/executive-data.ts`: incluir `lead.lastInboundAt` no cálculo de `lastActivity` (junto de `createdAt`, `lastActivityAt`, `journeyLastEventAt`).

**4. Fim da persistência otimista silenciosa**
- `src/lib/workspace-operational.functions.ts`: usar `{ count: "exact" }` no update e retornar `{ ok, updated }` com a contagem real de linhas.
- `src/lib/lead-state.ts`: `persist()` passa a aguardar a confirmação; só grava no cache local depois de `updated > 0`; em falha (erro ou 0 linhas) mantém o estado anterior, reverte o cache e emite um aviso (toast) em vez de fingir sucesso.

**5. Permissão operacional da Gestora**
- Migration: função `SECURITY DEFINER` `public.set_lead_operational(_id, _viewed_at, _closed_at, _notes)` que grava **somente** esses três campos, autorizando `admin`, executivo responsável e `manager` que já enxerga o lead (mesma condição do SELECT atual). A política de UPDATE de `portal_leads` permanece exatamente como está — nada é afrouxado.
- `updateWorkspaceOperational` passa a usar essa função quando o patch contiver apenas campos operacionais; os demais campos continuam pelo caminho atual com RLS.

## Testes de aceite

1. Executivo responsável abre um lead NOVO -> vira EM ANDAMENTO; sai, volta e recarrega -> continua EM ANDAMENTO; `viewed_at` preenchido no banco.
2. Gestora abre um lead que enxerga -> vira EM ANDAMENTO e permanece após refresh; tentativa de alterar proprietário/identidade pela Gestora continua bloqueada.
3. Perfil sem permissão nenhuma -> a marcação falha visivelmente (aviso), sem estado falso na interface.
4. Redistribuir e transferir proprietário -> proprietário muda, auditoria registrada, lead permanece EM ANDAMENTO (não volta para NOVO).
5. Sincronização GreenSales com `updated_at` novo em lead já trabalhado -> permanece EM ANDAMENTO.
6. Investidor acessa o Portal/avança na jornada após a visualização -> volta para NOVO.
7. Investidor responde no WhatsApp -> volta para NOVO.
8. Encerrar pelo menu ⋮ -> ENCERRADO, estável após refresh; reabrir volta ao ciclo automático.
9. Polling/realtime/troca de aba sem nenhum fato novo -> nenhuma mudança de classificação.
10. Nenhum lead existente muda de estado apenas pela aplicação do plano (verificação por consulta antes/depois).

## Intocado

Portal dos Leads, Bloco 2 de identidade e `resolve_portal_identity`, cadência e motor de relacionamento, CRM, Remarketing, Backup, blindagem contra exclusão, políticas de RLS atuais de `portal_leads` e todos os dados existentes.
