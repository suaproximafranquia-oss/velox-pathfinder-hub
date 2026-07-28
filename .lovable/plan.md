# Portal Velox — Implementação Mestra, Parte 1/3

Objetivo: consolidar a arquitetura já homologada — sem reconstruir nada — introduzindo apenas as camadas mínimas que a Parte 1 pede (Perfil Inteligente, Linha do Tempo, Pendências, Central de Notificações e Central de Reuniões) e preparando o terreno para o Motor de Eventos da Parte 2.

## Princípios aplicados

- Zero mudanças em auth, rotas, overlays, permissões, atribuição investidor↔executivo, KPI Manager e Manual.
- Reuso máximo: `ExecutiveShell`, `executive-auth`, `teams`, `leads`, `investor-report`, `audit-log`, `simulator-modal`, `ai-assistant`, `journey-progress`.
- Baixo acoplamento: eventos passam por um único emissor central, módulos não se conhecem entre si.

## Escopo desta Parte 1

### 1. Motor de Eventos (semente, não implementação completa)
- Novo `src/lib/events/bus.ts`: emissor tipado leve (pub/sub em memória + persistência opcional em `localStorage`) com tipos:
  `journey.started | manual.completed | material.viewed | simulator.started | simulator.completed | meeting.created | meeting.rescheduled | meeting.completed | meeting.cancelled | profile.updated`.
- Sem lógica de negócio dentro do bus. Cada módulo apenas emite. Parte 2 conecta consumidores reais.

### 2. Perfil Inteligente do Investidor + Linha do Tempo
- Novo `src/lib/investor-profile.ts`: agrega, para um `leadId`/investidor, dados já existentes (lead capturado, progresso da jornada, simulações, reuniões) numa estrutura única `InvestorProfile { identity, journey, timeline[], pendings[] }`.
- Novo componente `src/components/executive/investor-profile-panel.tsx` renderizado como overlay (padrão modal-sobre-modal já usado).
- Linha do tempo: consome `bus` + histórico persistido; ordem cronológica, sem exclusão.

### 3. Pendências inteligentes
- Novo `src/lib/pendings.ts`: deriva pendências a partir do estado atual (jornada interrompida, simulação não finalizada, reunião próxima, retorno pendente). Puro/derivado — sem tabela nova.
- Card "Pendências" na Central do Executivo (`executivo.home.tsx`), respeitando permissões via `visibleCollaborators`.

### 4. Central de Notificações
- Novo `src/lib/notifications.ts`: consome eventos do bus, mantém lista persistida por usuário, contador de não lidas.
- Novo `src/components/executive/notifications-bell.tsx` no header do `ExecutiveShell` (ícone + badge + popover cronológico, acesso rápido ao Perfil Inteligente).
- Não interrompe fluxo: sem toasts obrigatórios.

### 5. Central de Reuniões
- Novo `src/lib/meetings.ts`: modelo `Meeting { id, investorId, executiveId, scheduledAt, status, notes[], postMeeting? }` com status `Agendada | Confirmada | Reagendada | Em andamento | Concluída | Cancelada`. Persistência local; arquitetura pronta para backend/Meet futuros.
- Nova rota `src/routes/executivo.reunioes.tsx` (não altera rotas existentes; apenas adiciona).
- Registro pós-reunião aditivo (nunca sobrescreve). Cancelamento preserva motivo.
- Emite eventos no bus → alimenta Linha do Tempo e Notificações automaticamente.
- Novo módulo em `src/config/modules.ts` ("Central de Reuniões"), respeitando padrão de card existente. O card externo "Reuniões" (Google Meet) permanece intacto.

### 6. Simulador — apenas ajustes de nomenclatura e integração
- Renomear rótulos visíveis para "Simulador Inteligente de Potencial de Receita" onde ainda houver variação (auditar `simulator-modal.tsx`, `modules.ts`, `universo.tsx`, textos do Portal). Nenhuma mudança de UX/cálculo.
- Ao concluir simulação: emitir `simulator.completed` no bus com payload mínimo (produtos, volume total, receita estimada, leadId quando existir). Isso já alimenta Perfil, Timeline, Notificações e Pendências sem acoplamento.

### 7. Dashboard Executivo
- Sem reconstrução. Apenas adicionar seções derivadas: "Pendências" e atalho "Notificações recentes" reutilizando os módulos acima.
- Indicadores continuam do KPI Manager (segregação Portal ↔ KPI preservada — nenhum cruzamento novo).

### 8. Auditoria
- Reusar `src/lib/audit-log.ts`. Ações relevantes de reuniões e simulações registram entrada de auditoria via o mesmo helper.

## O que NÃO muda

- `src/routes/__root.tsx`, shells editoriais, Manual, Material Institucional, KPI Manager, Brain, IA (prompt), login, permissões, atribuição de executivos, identidade visual, URLs, integrações externas.
- Nenhum componente homologado é substituído.

## Estrutura de arquivos (novos)

```text
src/lib/
  events/bus.ts
  investor-profile.ts
  pendings.ts
  notifications.ts
  meetings.ts
src/components/executive/
  investor-profile-panel.tsx
  notifications-bell.tsx
  pendings-card.tsx
  meetings/
    meetings-list.tsx
    meeting-dialog.tsx
src/routes/
  executivo.reunioes.tsx
```

## Validação ao final

- Typecheck limpo.
- `/`, `/manual`, `/universo`, `/executivo/*` existentes inalterados visualmente.
- Simulador segue funcionando idêntico; agora emite evento.
- Novo bell aparece no header executivo; nova rota `/executivo/reunioes` acessível; Perfil Inteligente abre em overlay a partir da lista de investidores.
- Nenhuma dependência externa nova é obrigatória.

Ao aprovar, executo tudo em uma sequência de edits paralelas e valido typecheck antes de encerrar.