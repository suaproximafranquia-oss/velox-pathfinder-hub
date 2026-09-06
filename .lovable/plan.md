# Central de Operações — relatório fiel da Ação do Dia (/f)

A Central deixa de ser um painel de aderência/pendências e passa a ser um relatório do que foi **efetivamente realizado** na Ação do Dia: quatro números, um resumo por dia e nada além disso. Nenhuma ação é criada, executada ou alterada por esta tela.

## Decisões já fechadas

- Ligação concluída conta como **ligação efetuada**, tenha o investidor atendido ou não.
- Primeiro contato (E0) **não aparece** na Central.
- Só entram reuniões **concluídas pela Ação do Dia**.
- Cada número pertence a **quem executou** a ação, não ao responsável do lead.
- Sem gráfico, sem "Ver detalhes", sem atrasos, sem redistribuição, sem expurgo agora.

## O que a tela mostra

Seletor de período no topo: Hoje, Ontem, Últimos 7 dias, Este mês, Período personalizado (data inicial/final, sem datas futuras).

Quatro cards com o total do período:

- Ligações efetuadas
- Mensagens enviadas
- Reuniões realizadas
- Pulos

Abaixo:

- **Colaborador** (Marton, Milton, Paulo, Carlos, Talita): abre direto na própria operação, com a tabela "Resumo por dia" — Data | Ligações | Mensagens | Reuniões | Pulos | Total. Dias sem produção aparecem com zero.
- **Gestora (Larissa) e Administrador (Thiago)**: tabela consolidada Executivo | Ligações | Mensagens | Reuniões | Pulos | Total, com a mesma tabela por dia logo abaixo (totais da equipe). Larissa não aparece como linha de executiva; Thiago aparece, porque também opera.
- Thiago pode alternar entre "Toda a equipe" e "Minha operação".
- Clicar no número de **Pulos** abre a relação dos leads pulados (investidor, etapa, motivo, horário) e cada linha leva ao lead pelo seu identificador oficial, abrindo onde ele estiver disponível para aquele usuário.

Visual: mesmos componentes, cores e espaçamentos já usados no Portal Financeira; área de conteúdo clara sobre o ambiente atual, números grandes nos cards, tabela com rolagem horizontal em telas estreitas.

## Onde os números nascem (sem nova fonte de verdade)

Todos já existem hoje; nada é criado e nenhuma tabela nova é necessária.

| Indicador | Fonte oficial | Quem executou | Data usada |
| --- | --- | --- | --- |
| Ligações efetuadas | `crm_cadence_tasks` com `status=DONE` e canal de ligação | `completed_by` | `completed_at` |
| Mensagens enviadas | `relationship_engine_log` `acao_do_dia_mensagem_registrada`, apenas quando a etapa foi de fato concluída | `actor` | `details.at` |
| Reuniões realizadas | `relationship_engine_log` `acao_do_dia_reuniao_resolvida` com resultado "compareceu" | `actor` | `details.at` |
| Pulos | `relationship_engine_log` `acao_do_dia_pulada` | `actor` | `details.at` |

Detalhe técnico relevante: hoje o registro de mensagem grava no histórico mesmo quando a confirmação é repetida; o relatório vai contar apenas as execuções que realmente concluíram a etapa (o registro já traz esse resultado), evitando contagem dupla.

Agrupamento por **data operacional** (fuso de São Paulo), a mesma usada pela Ação do Dia — assim o relatório bate exatamente com o que o executivo viu na tela.

Autorização continua no servidor, pela camada centralizada já existente: colaborador recebe apenas o próprio recorte (filtrado no servidor, não no navegador); gestão e administração recebem a equipe.

## Alterações técnicas previstas

- `src/server/crm/operations-center.server.ts`: novo agregador de produção (quatro indicadores, por executivo e por dia), substituindo a consolidação de aderência/pendências/vencidas. Somente leitura.
- `src/lib/crm/operations-center.functions.ts`: passa a aceitar período livre e a resolver o escopo (própria operação x equipe) pela identidade server-side; deixa de exigir perfil de gestão para o colaborador ver o próprio relatório.
- `src/components/executive/central-operacoes/central-home.tsx`: nova composição — seletor de período, quatro cards, tabela por executivo (gestão/admin), tabela por dia e painel de pulos com navegação para o lead.
- Nada é tocado na Ação do Dia, no motor de cadência, na fila, na Biblioteca, no E0, no WhatsApp, no Safety Lock, nem em `/s`, `/seg` e `/`.

## Retenção

Nada será apagado nesta etapa. As fontes acima também sustentam auditoria, timeline e histórico do relacionamento, então um expurgo de 12 meses só faria sentido como cópia consolidada própria da Central — algo a decidir depois, em separado.
