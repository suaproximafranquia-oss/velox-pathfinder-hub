# Financeira /f — Construção final em uma única rodada

Escopo exclusivo: Corporate Workspace / Financeira `/f`. Não altera `/`, `/s`, `/s/portal`, `/seg`, Solar, Seguros. Nenhuma etapa nova, nenhum `step_key` técnico renomeado, nenhum reset, nenhum histórico apagado, nenhum envio real de WhatsApp habilitado. Humanização, RF, ER, domingo de homologação, Backup, KPI, ownership, permissões e Safety Lock ficam intocados.

## 1. E0 completo (primeiro contato)

Hoje o E0 é apenas uma mensagem. Passa a ser uma etapa com três ações internas, na mesma fila do motor:

```text
E0  ligação 1  →  (não atendeu) +10 min  →  ligação 2  →  (não atendeu) mensagem do E0  →  E0 concluído  →  libera E1
```

- Atendeu na 1ª ou na 2ª: as ações seguintes do E0 são canceladas, nada avança sozinho, o lead entra em "aguardando encaminhamento".
- A mensagem só aparece depois da 2ª tentativa registrada como não atendida.
- Duas ações do mesmo E0 nunca ficam disponíveis ao mesmo tempo.
- Janela própria do E0 e o modo manual/automático por executivo permanecem exatamente como estão.
- O nome "D0" não existe em lugar nenhum.

## 2. Régua V2 realmente alimentada (E1–E8)

- A conclusão do E0 passa a criar a primeira obrigação do E1 na fila do motor; hoje a régua fica parada esperando um E0 que nunca chega nela.
- E1: ligação 1 → 3 h → ligação 2 → mensagem, tudo dentro de E1. Ligação às 16h que não cabe na janela fica pendente e executa na próxima abertura, ainda como E1.
- E2, E3 e E4: ligação antes da mensagem; atendeu cancela a mensagem daquela etapa e suspende o avanço.
- Correção do escopo do cancelamento: hoje uma ligação atendida cancela pendências do lead inteiro; passa a cancelar apenas as ações da etapa atendida.
- Saída do estado "aguardando encaminhamento": agendamento criado, mudança de estágio ou material efetivamente enviado liberam a cadência (hoje nada libera).
- Prazos E5→E6 (7), E6→E7 (2), E7→E8 (3) e o calendário já estão corretos e não serão mexidos.

## 3. Material — E4 → E5

- Passa a existir registro estruturado quando o executivo confirma que a apresentação foi efetivamente disponibilizada. Só esse registro ativa MATERIAL_ENVIADO e o ramo E5 → E6.
- Falar sobre o material, prometer ou oferecer não ativa nada.

## 4. Lead NOVO, atraso e ordem da segunda-feira

- Corte de expediente passa de 18:00 para 17:30.
- Sexta após 17:30, sábado, domingo e segunda antes das 09:00 não contam como dia trabalhado.
- Novo estado NOVO: o lead ganha sua primeira oportunidade operacional na abertura seguinte e nunca nasce atrasado.
- Ordem da fila: 1) Agendamentos · 2) Novos, por ordem original de entrada · 3) Cadência atrasada · 4) Cadência devida no dia.

## 5. Sábado

- Botão "Pular para o próximo dia útil", disponível apenas para lead NOVO, sem justificativa, sem nota de abandono: não encerra o lead, não muda etapa, joga para segunda.
- Sábado continua executando o que já é devido e continua sem antecipar tarefas de segunda.

## 6. Biblioteca

- Nomenclatura editorial exibida como E0–E8, R1–R4, RE0–RE3, mapeada sobre as chaves técnicas atuais — nenhuma chave é renomeada.
- Correção do desalinhamento entre nome editorial e chave técnica já diagnosticado.
- Conteúdos que existem mas ficaram inativos ou mal associados são reativados/reassociados. Só é recuperado o que comprovadamente existia.
- Word/ZIP nunca volta como fonte operacional.
- O motor sempre lê a mensagem ativa da Biblioteca no momento da execução.

## 7. E7 e E8 — quatro espaços cada

Cada uma das duas etapas passa a exibir quatro campos:

```text
SEM_CONTATO      + COM_NOME
SEM_CONTATO      + SEM_NOME
MATERIAL_ENVIADO + COM_NOME
MATERIAL_ENVIADO + SEM_NOME
```

Nenhum texto é inventado. Espaço sem conteúdo fica visivelmente pendente e bloqueia o envio daquela variante até a gestão cadastrar.

## 8. Central dos Nomes como camada de interpretação

- A Central não é reconstruída nem reimportada; os ~100 mil nomes permanecem como estão.
- O motor passa a extrair o primeiro nome do lead e consultar a Central: encontrado → COM_NOME; não encontrado → SEM_NOME.
- Não altera o nome original do lead e não aprende nomes novos automaticamente.
- Vale para todas as origens e todas as etapas.

## 9. Follow-up do GreenSales

- GreenSales é a origem; o follow-up é interpretado somente quando o lead está em AGENDAMENTOS.
- Espelhamento no `portal_meetings` existente, mantendo o mesmo compromisso quando a data muda.
- Histórico de reagendamento preservado.
- Remoção na origem cancela o compromisso espelhado.
- T-5 aparece na Ação do Dia, como já acontece com as reuniões atuais.

## 10. Pós-agendamento

- Ao vencer o compromisso: resultado, "houve contato?" e "deseja reagendar?".
- Orientação fixa: o reagendamento é feito no GreenSales.
- Novo estado persistente "vencido sem contato e sem reagendamento" e obrigação de verificação após 24 h.
- O fluxo R só é liberado quando houver movimentação humana AGENDAMENTOS → FRIOS.

## 11. Trava real da Ação do Dia

- O executivo não escolhe livremente outro lead: precisa concluir ou pular a ação atual.
- Ligação antes da mensagem. Pular a ligação leva à próxima ação do mesmo lead; pular também a mensagem exige novo Pular com justificativa.
- Só depois disso o próximo lead é liberado.
- A trava é validada no servidor, não apenas escondida na tela.

## Detalhes técnicos

- Motor: `src/lib/relationship/cadence-v2.ts` ganha o plano de ações do E0 (call/10min/call/message); `cadence-v2-decide.ts` deixa de tratar E0 como externo. `cadence-v2-state.server.ts` passa a expor o estado do E0.
- Ponte de entrada: `src/server/relationship/e0.server.ts` e `src/server/crm/e0-actions.server.ts` passam a materializar as três ações do E0 em `relationship_queue` respeitando `e0-window.ts` e `first-contact-mode.server.ts`.
- `call-outcome.server.ts`: cancelamento filtrado por `step`; `clearAwaitingHandoff` passa a ser chamado por agendamento, mudança de estágio e evento de material.
- Material: novo evento estruturado `CONTENT_SENT`/`MATERIAL_REQUESTED` gravado em `relationship_events` a partir da confirmação do executivo.
- Atraso/NOVO: `daily-actions-overdue.ts` (`WORKDAY_END_HOUR` 18 → 17.5), novo bucket `novo` em `daily-actions.ts` e nova ordenação em `actionRank`; `daily-actions.server.ts` passa a marcar o lead novo.
- Sábado: nova ação de adiamento sem justificativa em `daily-actions-log.server.ts`, restrita a lead NOVO e ao sábado.
- Trava: verificação server-side em `daily-actions.server.ts` antes de aceitar conclusão/pulo de um lead que não é o corrente.
- Nomes: `name-central.server.ts` ganha consulta por `normalized_key`, usada por `step-message.server.ts` para escolher `body` ou `body_without_name`.
- Biblioteca: `message-library.server.ts` e `step-registry.server.ts` passam a usar rótulos editoriais e `step_context`; migration mínima apenas para preencher `step_context` e criar os quatro slots de E7/E8, sem apagar linhas.
- GreenSales/agendamento: normalizador de payload + `meetings.functions.ts` para espelhar, versionar e cancelar compromissos; novo estado pós-vencimento em `portal_meetings`.
- Migrations somente aditivas (colunas/estados novos). Nenhuma tabela nova, nenhum DELETE.

## Testes antes de entregar

E0 nos seis desfechos; E1 com ligação fora da janela; E2/E3/E4 atendido e não atendido; E4→E5 com e sem registro de material; prazos E5→E8; sexta 17:31 não vira atraso na segunda; ordem da segunda-feira; botão de sábado; COM_NOME/SEM_NOME pela Central; espelhamento e cancelamento de follow-up; verificação 24 h; trava server-side.
