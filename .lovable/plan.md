# Financeira /f — Última construção do Motor, Biblioteca e Agendamento

Escopo exclusivo: Corporate Workspace / Financeira `/f`. Nada em `/`, `/s`, `/s/portal`, `/seg`, Solar ou Seguros.
Régua: E0–E8, R1–R4, RE0–RE3. ER não existe. RF permanece só conceito futuro.

## 1. Camada editorial da Biblioteca

O texto de quase toda etapa existe, mas está guardado sob a chave de uma geração anterior. Nenhuma chave técnica é renomeada e nenhum texto é reescrito: cria-se um mapa oficial entre o nome de negócio e a chave onde o texto realmente está.

- Mapa: E2→`E3`, E3→`E12`, E4→`E2`, E5→`RE0`, E6→`E20`, E7→`E27`, E8→`RE1`, R2→`E4`, R3→`E5`, R4→`RE2`, RE0→`E6`, RE1→`E7`, RE2→`FINALIZACAO`, RE3→`R1`. E0 e E1 já estão corretos.
- A Biblioteca passa a exibir e ordenar pelo nome de negócio; o motor busca o conteúdo pelo mapa.
- R1 volta a ter versão ativa a partir da versão histórica existente, publicada como nova versão (sem apagar histórico).
- Legado (ER*, RF0, RF1, V3, V4, TESTE, E0_V1, E30, RESPOSTA_AUTOMATICA) sai da visão operacional e permanece consultável como histórico.

## 2. E7 e E8 com os quatro conteúdos

Hoje a tela só oferece "com nome" e "sem nome". Passa a oferecer, para E7 e E8, quatro espaços:
sem contato + com nome, sem contato + sem nome, material enviado + com nome, material enviado + sem nome.
Espaços sem texto ficam pendentes e visíveis; nenhum texto é inventado. As demais etapas seguem com dois espaços.

## 3. E0 dentro da régua V2

E0 passa a ser: ligação → 10 minutos → ligação → mensagem, dentro da janela do executivo.
O modo manual/automático continua vindo exclusivamente da configuração do executivo, sem exceção por lead. Ligação atendida encerra o E0 e aguarda encaminhamento.

## 4. Fechamento do motor

- Cancelamento por ligação atendida passa a atingir só as ações que perderam finalidade, não o lead inteiro.
- A espera por encaminhamento ganha encerramento real quando o executivo registra o desfecho.
- O estágio anterior do lead passa a ser gravado, para a regra de reengajamento funcionar de fato.
- O ramo de material (E4→E5) ganha os dois registros que faltam: material solicitado e material efetivamente enviado, gravados quando o executivo confirma.
- L1–L4 continuam apenas como histórico.

## 5. Agendamento e follow-up

- O campo de follow-up que já chega do GreenSales passa a ser lido e transformado em compromisso, só para lead em Agendamentos, com vínculo ao lead e identidade de origem.
- Reagendamento na origem atualiza o mesmo compromisso; remoção na origem cancela com histórico.
- Depois do horário do compromisso: pergunta se houve contato, estado "vencido sem contato" e obrigação de retomada em 24 horas.
- Compromisso de retorno combinado numa ligação ("te ligo quarta") vira compromisso formal.
- Transição de Agendamentos para Frios feita por decisão humana libera a cadência de reengajamento.

## 6. Atraso e nomes

- Estado NOVO passa a existir e o corte de atraso deixa de usar 18:00, respeitando a janela e o dia útil (sexta 17:31 não vira atrasado na segunda).
- A decisão com nome / sem nome passa a consultar a Central dos Nomes (100.787 nomes) no momento do COPIAR, usando apenas o primeiro nome e comparação sem acento. Nada é aprendido, adicionado ou alterado na Central.

## Detalhes técnicos

- Camada editorial em `src/lib/relationship/step-registry.server.ts` + `message-library.server.ts`; `renderFromLibrary` resolve pelo mapa. `message-library-panel.tsx` ganha rótulo de negócio, seletor de contexto para E7/E8 e recorte de legado.
- E0: migração de `e0.server.ts` para ações da V2 em `cadence-v2.ts`/`cadence-v2-decide.ts`, com `action_kind` de ligação e intervalo de 10 minutos.
- Cancelamento por escopo de etapa/ordem em `call-outcome.server.ts`; chamada de `clearAwaitingHandoff`; persistência de estágio anterior para `canStartReengagement`; eventos `MATERIAL_REQUESTED`/`CONTENT_SENT`.
- Follow-up: sincronização a partir de `crm_leads.raw_payload`, com identidade externa e vínculo em `portal_meetings` (colunas aditivas + novo valor de `origin`); obrigações pós-compromisso em `relationship_queue`.
- Atraso em `daily-actions-overdue.ts` (fim do `WORKDAY_END_HOUR = 18`); resolução de nome assíncrona contra `name_central`, substituindo a lista fixa de `name-base.ts` e restringindo `compoundTreatment` ao primeiro nome.
- Migrations aditivas apenas; nenhuma tabela nova, nenhum dado apagado, Safety Lock e WhatsApp real intocados.
