# Validação Técnica — Bloco 2: Identidade e Retorno do Lead

Nada foi implementado. Nenhum lead, tabela, cron ou sincronização foi alterado. Abaixo está o que a leitura do código e a consulta ao banco realmente mostram, seguida do desenho proposto.

## Parte 1 — Diagnóstico do que existe hoje

### O Portal já consulta o servidor antes de criar (parcialmente)

O formulário de entrada (Gateway) já faz uma consulta ao servidor antes de criar qualquer registro: ele chama uma restauração na nuvem que consulta a base real de leads por e-mail e WhatsApp. Se encontra, espelha o lead existente no navegador e a criação seguinte reaproveita esse cadastro.

Limitações confirmadas dessa consulta:

- Ela exige que **e-mail E telefone** pertençam ao mesmo cadastro. Um só dos dois não reconhece ninguém.
- Ela exige telefone com pelo menos 10 dígitos; sem telefone válido, devolve "não encontrado".
- A comparação de e-mail é por igualdade exata (minúsculas), e a de telefone pelos últimos 11 dígitos.
- Se a consulta falhar (rede, erro), o fluxo segue em silêncio e cria um novo lead.

### A decisão final continua sendo do navegador

Depois da consulta, quem decide "novo × recorrente" é o armazenamento local: a criação da sessão procura o lead por e-mail e depois por telefone **dentro da lista local do navegador** e, não achando, cria um lead novo com identificador gerado no próprio navegador. O envio para o servidor é posterior e "dispare e esqueça". Ou seja: o servidor é consultado, mas não é a autoridade, e nada é atômico.

### Cenários A–E como o sistema trata hoje

| Cenário | Consulta prévia ao servidor | Resultado prático |
|---|---|---|
| A) telefone e e-mail iguais | encontra | reconhece o mesmo cadastro, não duplica |
| B) telefone igual, e-mail diferente | não encontra | **cria um segundo lead** |
| C) e-mail igual, telefone diferente | não encontra | cria um segundo lead na consulta; o espelhamento posterior no servidor pode fundir por e-mail, mas o navegador já tratou como novo |
| D) ambos diferentes | não encontra | novo lead (correto) |
| E) e-mail de uma pessoa e telefone de outra | não encontra | cria novo lead; a marcação de conflito existente só compara a lista local |

O cenário B já ocorreu de verdade: existem dois cadastros reais com o mesmo WhatsApp (final 999887766) e e-mails diferentes, criados em 24 e 25/08. Também há um grupo de três cadastros de teste com o mesmo telefone.

### Reaproveitamento da regra existente

A função de decisão de identidade (`resolveIdentityMatch`) é pura: recebe apenas "id encontrado por e-mail" e "id encontrado por telefone" e devolve novo / correspondência / conflito. Não usa navegador nem armazenamento local. **Pode ser reutilizada no servidor sem qualquer mudança de semântica.**

### Constraints no banco

Consultei os índices reais das duas tabelas de leads:

- Base do Portal: índices por e-mail (apenas de busca, não único), por data, por executivo e escopo, e um único somente para o par origem+identificador externo.
- Base do CRM: único somente para origem+identificador externo.

**Não existe hoje nenhuma restrição que impeça dois leads com o mesmo telefone normalizado nem com o mesmo e-mail.** Por isso os duplicados acima puderam existir. Criar um índice único agora **falharia**, porque os duplicados já existentes violariam a regra — e removê-los é proibido.

### Respostas diretas

1. Sim — já acontece, mas de forma incompleta e sem autoridade.
2. Sim — telefone e e-mail normalizados, sem usar o nome (o nome já não participa da identificação hoje).
3. Sim, em qualquer navegador, aba anônima ou aparelho, desde que a regra passe a ser "e-mail **ou** telefone" e a consulta rode no servidor.
4. Sim — é possível transformar em uma única operação de servidor (consultar → decidir → criar ou reaproveitar) com trava de concorrência.
5. Ver tabela A–E acima.
6. Sim, sem alteração.
7. Não existe.
8. Sim — com trava de exclusão por chave (telefone/e-mail) dentro da operação de criação, sem tocar em nenhum lead existente.
9. Sim — a resposta do servidor já contém os dados necessários para reidratar a sessão sem cache anterior.
10. Sim — o armazenamento local passa a ser apenas cache de navegação.
11. Sim — nada disso exige mexer no Portal dos Leads, no formulário, no fluxo de leads novos, na sincronização externa, no CRM ou nos leads históricos.
13. **Sim.** Com o desenho abaixo, abrir uma aba anônima amanhã e informar o mesmo nome, e-mail e telefone encontra o mesmo cadastro existente e não cria um segundo lead. Hoje isso já funciona quando **os dois** dados batem; passa a funcionar também quando apenas um deles bate.

## Parte 2 — Desenho proposto (para autorização posterior)

1. **Resolvedor único no servidor.** Uma operação de servidor recebe e-mail e telefone, normaliza (e-mail em minúsculas sem espaços; telefone pelos últimos 11 dígitos), busca por e-mail **ou** por chave de telefone, e aplica a regra existente de decisão.
2. **Resultado tipado**: `novo`, `recorrente` (com o identificador do cadastro e os dados de reidratação) ou `conflito` (e-mail de um, telefone de outro). Conflito nunca funde automaticamente: reaproveita o cadastro do telefone e registra a divergência para revisão, mantendo a semântica atual.
3. **Criação atômica.** Quando o resultado é "novo", a criação acontece na mesma operação de servidor, protegida por uma trava por chave normalizada, de modo que dois envios simultâneos nunca criem dois cadastros.
4. **Reidratação da sessão** a partir da resposta do servidor; o armazenamento local vira cache, sem autoridade para decidir novo × recorrente.
5. **Nome nunca identifica** e a correção manual do executivo continua com precedência sobre o que vier do formulário.

### Detalhes técnicos

Arquivos envolvidos (leitura): `src/components/portal/gateway-overlay.tsx`, `src/lib/portal-leads-sync.ts`, `src/lib/portal-leads.functions.ts`, `src/lib/portal-session.ts`, `src/lib/portal-identity.ts`, `src/lib/portal/ownership.ts`, `src/lib/leads.ts`.

Alterações previstas: um novo arquivo de função de servidor para o resolvedor; ampliação da consulta existente (`lookupPortalLead`) de "e-mail E telefone" para "e-mail OU telefone"; troca da decisão local em `startPortalSession` pelo resultado do servidor; `restoreLeadFromCloud` passa a repassar o resultado tipado.

Funções envolvidas: `lookupPortalLead`, `syncPortalLead`, `restoreLeadFromCloud`, `startPortalSession`, `resolveIdentityMatch`, `resolveIdentity`, `normalizePhone`, `normalizeEmail`.

Tabelas consultadas: base de leads do Portal (leitura por e-mail e telefone). Nenhuma tabela de CRM, sincronização ou histórico é lida para decidir identidade.

Tabelas que precisariam ser alteradas: nenhuma obrigatoriamente. Opcional e puramente aditivo: uma coluna calculada com a chave de telefone e um índice **não único** para a busca ficar rápida. Migração necessária: apenas essa, se optarmos pelo índice. Nenhuma migração remove, altera ou funde dados.

Riscos:

- Ampliar para "e-mail OU telefone" faz o sistema reconhecer casos que hoje viravam cadastro novo — é o efeito desejado, mas muda o volume de "recorrentes".
- Telefones compartilhados (casal, familiar) passariam a ser tratados como a mesma pessoa; mitigação é o caminho de conflito, com revisão do executivo.
- Duplicados já existentes continuam existindo (não serão apagados); o resolvedor precisa escolher de forma determinística (mais antigo com relacionamento ativo) para não alternar entre eles.
- A trava de concorrência precisa ser curta para não segurar a entrada do investidor.

### Fora de escopo (não será tocado)

Portal dos Leads, formulário de entrada, fluxo de leads novos, sincronização externa, CRM, cadência, motor de relacionamento e leads históricos.
