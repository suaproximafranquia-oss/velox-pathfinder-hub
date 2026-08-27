# Bloco 2 — Identidade e Retorno do Lead: plano de implantação (fechado)

Nada implementado ainda. Decisões P1–P7 já fixadas; abaixo as três confirmações técnicas finais.

## Decisões finais

| # | Decisão |
|---|---|
| P1 | Duplicados: relacionamento ativo → atividade mais recente → mais antigo → identificador. Vínculo fixado após a primeira eleição. |
| P2 | Conflitos na ficha **e** em fila de pendências para a gestão. |
| P3 | Normalização unificada só no caminho de identidade do Portal. Token e GreenSales intocados. |
| P4 | Falha de servidor: não cria nada; nova tentativa e aviso. |
| P5 | Correção manual protege nome, e-mail, telefone e cidade. |
| P6 | Telefone coincidente basta para reconhecer e emitir o token. |
| P7 | Propriedade do lead: regra atual mantida. |

## 1. Onde ficam os dados divergentes

Estrutura já existente e reutilizada:

- **`manual_overrides`** (jsonb, já na base, hoje vazio nos 51 cadastros, já respeitado pela sincronização do CRM) — guarda a marca de correção manual por campo (P5). Nada novo aqui.
- **`portal_journey_events`** — recebe o registro de auditoria de cada divergência (data, campo, valor informado, origem do acesso). Trilha imutável, só acrescenta linhas.

O que **não** existe hoje e é o mínimo a criar (aditivo, nenhuma linha existente alterada):

- **`identity_alternates`** (jsonb, padrão `{}`) em `portal_leads` — lista de e-mails e telefones informados pelo investidor que divergem do cadastro principal, cada um com data e origem. O campo principal (`email`, `whatsapp`) nunca é tocado pelo fluxo automático.
- **`identity_conflict`** (jsonb, nulo por padrão) em `portal_leads` — marca do conflito com referência cruzada ao outro cadastro, data e motivo. Hoje existe apenas no cache do navegador (`LeadRecord.identityConflict`), sem coluna correspondente; é essa coluna que alimenta a fila de pendências da gestão (P2), por simples consulta de "conflito não resolvido".

Nenhuma tabela nova é necessária. Regra permanente: divergência entra em `identity_alternates` + `identity_conflict` + evento de auditoria; o campo principal só muda por ação manual do executivo.

## 2. Como a trava separa histórico de novos cadastros

Estado real conferido: 51 cadastros, 2 grupos de telefone repetido, 0 e-mails repetidos, nenhum índice de unicidade por telefone ou e-mail.

Mecanismo em duas camadas:

**(a) Atomicidade — dentro da operação.** Consultar → decidir → criar roda em **uma única transação** numa função no banco. A primeira instrução da transação adquire uma trava exclusiva derivada do hash da chave normalizada (telefone; e-mail quando não houver telefone). A segunda requisição simultânea fica bloqueada até o commit da primeira, e ao entrar já enxerga o cadastro recém-criado — reaproveita e devolve **o mesmo identificador**. A trava é liberada automaticamente no fim da transação e não bloqueia nenhuma outra operação da base.

**(b) Separação do acervo — o índice.** Uma coluna nova `identity_key` (texto, nula) é preenchida **somente** nos cadastros criados a partir da ativação; os 51 históricos permanecem com valor nulo. O índice é **único parcial**: aplica-se apenas às linhas onde `identity_key` não é nulo. Consequências diretas:

- os duplicados históricos não violam o índice, porque estão fora dele;
- a migration não faz backfill, não valida, não altera e não recusa nenhum registro existente;
- a criação do índice é apenas leitura sobre linhas nulas — não modifica dados;
- mesmo que a aplicação falhe, o banco recusa fisicamente o segundo cadastro novo com a mesma chave.

Um índice **não único** por telefone normalizado também será criado, apenas para desempenho da consulta — sem qualquer efeito sobre os dados.

Migration inteiramente aditiva: três colunas novas (`identity_alternates`, `identity_conflict`, `identity_key`), uma função e dois índices. Zero `UPDATE`, zero `DELETE`, zero alteração de coluna existente.

## 3. Testes de aceite (com o teste de concorrência real)

**Teste obrigatório de concorrência.** Base sem o cadastro; duas requisições disparadas simultaneamente com o mesmo telefone/e-mail. Esperado: exatamente **um** cadastro criado, **o mesmo investorId** devolvido às duas, nenhum segundo lead, contagem total da tabela aumentada em exatamente 1. Repetir com quatro requisições simultâneas e com telefone com máscaras diferentes (com e sem DDI) para provar a normalização.

Demais testes:

1. Telefone existente + e-mail novo → reaproveita; e-mail principal intacto; novo em `identity_alternates`; conflito e auditoria registrados; nenhum cadastro novo.
2. E-mail existente + telefone novo → reaproveita; telefone principal intacto; novo em alternates; conflito registrado; pendência para o executivo.
3. Telefone de um lead + e-mail de outro → sessão no dono do telefone; conflito cruzado nos dois; nenhum merge, nenhuma exclusão.
4. Servidor indisponível durante a operação → nenhum cadastro criado; investidor recebe pedido de nova tentativa; ao voltar, reconhece corretamente e não duplica.
5. Outro navegador, aba anônima e outro dispositivo → mesmo cadastro.
6. Duplicados históricos → os 51 intactos; o mesmo eleito em três acessos seguidos.
7. Mesmo nome com contatos diferentes → cadastro novo (nome não identifica).
8. Nome corrigido pelo executivo → prevalece sobre o formulário; valor do formulário só na auditoria.
9. Consulta pública → não devolve nome, executivo nem histórico de terceiros.
10. Sessão reidratada → jornada e progresso corretos no cadastro certo.

## Resposta à pergunta final

**Sim.** Com o armazenamento das divergências definido (reuso de `manual_overrides` e da trilha de eventos, mais três colunas aditivas), o isolamento do acervo garantido pelo índice único parcial sobre uma chave que só os novos cadastros possuem, e o teste real de concorrência incluído, o plano está tecnicamente fechado. Não restam decisões arquiteturais pendentes.

## Fora do escopo

Portal dos Leads (formulário, telas, campos, regras comerciais), GreenSales, CRM, cadência, mensagens, motor de relacionamento, Biblioteca, templates, backup e todo o acervo histórico.

## Arquivos e alterações previstas

- Nova função de servidor de resolução de identidade (chamada pelo overlay de identificação; o identificador deixa de nascer no navegador).
- `src/lib/portal-leads.functions.ts` — consulta passa de "e-mail E telefone" para "e-mail OU telefone", com retorno mínimo e seguro.
- `src/lib/portal-session.ts` e `src/components/portal/gateway-overlay.tsx` — passam a obedecer ao servidor.
- `src/lib/portal-leads-sync.ts` — erro deixa de ser tratado como "não encontrado".
- `src/lib/workspace-lead-edit.ts` — grava as marcas de correção manual.
- Migration aditiva: colunas `identity_alternates`, `identity_conflict`, `identity_key`; função de resolução atômica; índice único parcial e índice de telefone.
