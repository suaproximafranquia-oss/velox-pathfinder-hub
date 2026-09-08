# Financeira /f — Construção única: Biblioteca, Agendamento e Central dos Nomes

Escopo exclusivo: Corporate Workspace / Financeira `/f`. Não altera `/`, `/s`, `/s/portal`, `/seg`, Solar, Seguros nem estruturas compartilhadas. Nada é apagado: histórico, versões e auditoria permanecem.

## Bloco 1 — Biblioteca: reencontro entre etapa de negócio e texto

Os textos existem; estão hospedados em chaves técnicas de outra geração, e o motor pede pela chave. Correção sem renomear nada e sem reescrever texto.

- Criar um mapa oficial etapa de negócio → chave técnica real (E2→`E3`, E3→`E12`, E4→`E2`, E5→`RE0`, E6→`E20`, E7→`E27`, E8→`RE1`, R2→`E4`, R3→`E5`, R4→`RE2`, RE0→`E6`, RE1→`E7`, RE2→`FINALIZACAO`, RE3→`R1`; E0 e E1 já coincidem).
- Motor e Biblioteca passam a resolver o texto por esse mapa. A chave técnica gravada continua intacta.
- Camada editorial exibe apenas a nomenclatura atual: E0–E8, R1–R4, RE0–RE3.
- R1 volta a ter versão ativa a partir das versões históricas hoje inativas.
- Resíduos (`TESTE`, `V3`, `V4`, `RF0`, `RF1`, `RESPOSTA_AUTOMATICA`, `E0_V1`, `E30`, títulos ER) ficam marcados como legado, fora da lista oficial, sem exclusão.
- E7 e E8 passam a ter quatro espaços reais cada: SEM_CONTATO e MATERIAL_ENVIADO, cada um com versão com nome e sem nome. Espaço sem texto permanece pendente e bloqueia o envio com motivo — nenhum texto é inventado.

## Bloco 2 — Follow-up do GreenSales como compromisso

O campo chega em 655 leads e hoje ninguém o lê.

- Ler e normalizar o follow-up na sincronização.
- Dar identidade externa ao compromisso (origem GreenSales + identificador do lead) e vincular lead ao compromisso.
- Criar compromisso somente quando o lead estiver em AGENDAMENTOS; nos demais estágios o follow-up é ignorado operacionalmente.
- Reagendamento é sempre o mesmo compromisso atualizado, com histórico de cada mudança de horário. Nunca três reuniões.
- Follow-up removido na origem cancela o compromisso espelhado com o motivo "removido na origem".
- Com o compromisso persistido, o T-5 e a prioridade máxima já existentes passam a funcionar também para o follow-up.

## Bloco 3 — Pós-agendamento e liberação do R

- Chegado o horário: "Houve contato no agendamento?" Sim → nota opcional e concluído. Não → "Deseja reagendar?".
- Reagendar sim → orientação para refazer no GreenSales, com atualização automática no Portal. O Portal não cria horário novo.
- Reagendar não → estado persistente "vencido sem contato e sem reagendamento".
- 24h depois, obrigação persistente: encerrar o fluxo sem gerar R, ou orientar a mover o lead para Frios.
- Gravar o estágio anterior do lead, detectar a transição humana AGENDAMENTOS→FRIOS e só então acionar a liberação do reengajamento, criando R1. O tempo passar não libera R.
- Congelamento em AGENDAMENTOS permanece como está: já funciona.
- Ligação atendida com promessa de retorno vira compromisso interno formal, congelando a cadência e aparecendo na Ação do Dia. Nada é criado no GreenSales.

## Bloco 4 — Central dos Nomes ligada ao motor

- A pergunta "este primeiro nome é confiável?" passa a ser respondida pelos 100.787 nomes já cadastrados, no lugar da lista fixa em código.
- Consulta no servidor, no momento em que a mensagem é montada, por chave normalizada indexada. Sem cópia de dados, sem tabela nova, sem reimportação.
- Somente o primeiro nome é considerado; nome composto deixa de ser montado.
- Comparação ignora maiúsculas, espaços, pontuação e acento; a exibição preserva o acento enviado pelo lead e usa inicial maiúscula.
- Sem correspondência confiável → SEM_NOME. A Central nunca altera o nome do lead, nunca aprende sozinha e nunca recebe nomes automaticamente.
- Decisão de nome e contexto de E7/E8 continuam independentes.

## Detalhes técnicos

- Migrations aditivas apenas: `step_context` já existe em `relationship_message_library` e passa a ser preenchido para E7/E8; `portal_meetings` ganha identidade externa (origem/ID do lead) e o check de `origin` é ampliado; `crm_leads` ganha registro de estágio anterior; estado "vencido sem contato" e a pendência de 24h são persistidos em tabela já existente de obrigações.
- Arquivos centrais: `message-library.server.ts`, `step-message.server.ts`, `step-registry.ts`, `cadence-v2-state.server.ts`, `call-outcome.server.ts`, `daily-actions.server.ts`, `names.ts` / `name-base.ts`, sincronização GreenSales.
- `canStartReengagement` (`cadence-v2.ts:521`) já está correto e testado; só passa a ser chamado no ciclo produtivo com o estágio anterior real.
- Não são criadas etapas novas, ER nem RF; Safety Lock, ownership, KPI, alertas, backups, permissões e Portal não são tocados; WhatsApp real continua desligado.
- Testes: mapa editorial, quatro contextos de E7/E8, criação/reagendamento/cancelamento idempotentes do follow-up, transição AGENDAMENTOS→FRIOS liberando R1, congelamento, e resolução de nome contra a Central.
