# Construção consolidada — Financeira /f

Escopo exclusivo de `/f`. Sem tabela nova de motor, sem segunda fila, sem alterar `/s`, `/s/portal` ou `/seg`, sem apagar histórico.

## 1. Central de Operações — Resolver pendência

- Registrar a recuperação também quando o desfecho é de ligação (hoje só mensagem concluída e reunião atendida registram).
- A resolução passa a devolver a confirmação do servidor; com ela a Central relê o relatório oficial.
- Efeito: pulo aberto diminui, contador de recuperadas sobe, a pendência some da lista e o botão "Resolver pendência" desaparece sem F5.
- O histórico continua append-only; nada é apagado ou reescrito.

## 2. Leads — "Marcar todos como lidos"

- Ação em lote que aplica exatamente a mesma marcação de visualização já usada ao abrir um lead, apenas nos leads listados e ainda não visualizados.
- Mantém o comportamento global por lead (não se inventa leitura por usuário).
- Não altera estágio, cadência, Ação do Dia, histórico, atividade comercial, ordem operacional; não sincroniza com a origem nem envia mensagem.

## 3. Portal do Investidor /f — imagens editáveis

- Modo navegador (padrão): somente leitura, igual a hoje.
- Modo editor: administrador autorizado substitui ou restaura imagens e salva de uma vez.
- Reaproveita o upload e o armazenamento já existentes da Revista/Institucional; nenhuma mídia nova é criada.
- Alvo: as imagens de chave estável do Portal (capa da home, capas dos seis módulos, galeria de Nossa Estrutura e capa de Princípios).
- "Excluir imagem" remove apenas a substituição — a imagem original volta intacta.
- A substituição é por unidade, para não afetar outras marcas.

## 4. Cadência-base — ajuste para 12 dias

- Alterar apenas dois intervalos: E4 → E7 passa de 4 para 3 dias e E7 → E8 passa de 3 para 2 dias.
- Resultado: E0→E1 = 1, E1→E2 = 2, E2→E3 = 2, E3→E4 = 2, E4→E7 = 3, E7→E8 = 2 — total de 12 dias.
- E5/E6 permanecem como caminho condicional do material, sem recalcular a cadência-base.
- Nada muda em: fila operacional, trava da posição 1, pré-gatilho, compromisso futuro fora da posição 1, V1 fora da sequência, V0 e contextos V2/V3.

## Detalhes técnicos

- Central: `src/server/crm/daily-actions-log.server.ts` (`recordSkipRecovery` também no caminho de desfecho de ligação), `pending-resolver-modal.tsx` e `central-home.tsx` (releitura de `relatorioOperacoes` após confirmação).
- Leads: reutilizar `markLeadViewed` / `updateWorkspaceOperational` → `set_lead_operational` (`portal_leads.viewed_at`), em lote.
- Portal: nova tabela mínima de substituição por chave de asset + unidade, lida por `assetUrl`; upload via `uploadMagazineFile`; permissão administrativa validada no servidor.
- Cadência: `src/lib/relationship/cadence-v2.ts` (`nextTransition`, casos `E4` e `E7`) e ajuste dos testes correspondentes.

## Verificação

- Typecheck, testes direcionados de cadência, Ação do Dia/Central e build.
- Nenhuma migration destrutiva; nenhum backfill de histórico.
