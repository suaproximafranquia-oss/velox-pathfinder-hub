# Segunda Rodada de Validação — Bloco 2: Identidade e Retorno do Lead

Nada foi implementado, alterado ou executado. Abaixo, as sete respostas com base no código e no banco reais.

## 1. Duplicados históricos

**Atual (confirmado).** Não existe nenhuma restrição de unicidade por telefone ou e-mail nas bases de leads — só existe unicidade para o par origem+identificador externo. Por isso já há duplicados reais: dois cadastros com o mesmo WhatsApp final 999887766 e e-mails diferentes (criados em 24 e 25/08), além de um grupo de três cadastros de teste com o mesmo telefone. Não há duplicidade por e-mail. A consulta prévia atual pega apenas o primeiro registro que casa e-mail e telefone juntos, sem critério de desempate.

**Proposto.** Quando o telefone (ou o e-mail) encontrar dois ou mais cadastros, o servidor nunca cria um novo e nunca funde nada. Ele escolhe **um único vencedor determinístico** pela seguinte ordem, sempre a mesma:

1. cadastro com relacionamento comercial ativo (descarta arquivados e apenas-jornada);
2. entre os ativos, o de **atividade real mais recente**;
3. persistindo empate, o **mais antigo por data de criação** (o cadastro histórico original);
4. último desempate: menor identificador, para ser 100% estável.

Os demais cadastros do grupo são apenas **apontados como duplicidade** em um registro de auditoria — permanecem intactos e visíveis.

**Garantia técnica.** O critério é aplicado em uma única consulta ordenada no servidor, não em código do navegador, então dois acessos com os mesmos dados devolvem sempre o mesmo cadastro. Adicionalmente, assim que um cadastro é eleito, ele é gravado como **vínculo de identidade fixo** para aquelas chaves (telefone/e-mail), de modo que acessos futuros nem dependam do desempate: eles seguem o vínculo já registrado.

**Riscos.** Se um duplicado histórico for arquivado e depois reativado manualmente, o vencedor poderia mudar — o vínculo fixo neutraliza isso. Se o executivo quiser trocar o cadastro eleito, isso é uma ação manual explícita.

**Decisão de negócio pendente:** confirmar a ordem de desempate (priorizar relacionamento ativo antes do mais antigo).

## 2. Telefone igual + e-mail diferente

**Atual.** A consulta prévia exige os dois dados; como o e-mail difere, nada é encontrado e **um segundo lead é criado**. Foi exatamente isso que aconteceu com os dois cadastros reais citados no item 1.

**Proposto.**

- Lead reaproveitado: **o Lead A** (o dono do telefone). Telefone é a chave forte.
- Novo e-mail: **salvo, porém como e-mail secundário/alternativo**, em um registro de identidade, não no campo principal.
- E-mail anterior: **preservado integralmente** como principal. Nada é sobrescrito.
- Sinal de conflito: **sim** — registro de divergência de e-mail com data, valor informado e origem do acesso, visível na auditoria da ficha.
- Novo lead: **não é criado**.

**Garantia técnica.** O campo principal só muda por edição manual do executivo; o fluxo do Portal grava valores alternativos em estrutura própria.

**Risco.** Um investidor que realmente trocou de e-mail continuará vendo o e-mail antigo como principal até o executivo confirmar a troca. É o comportamento desejado (nada silencioso), mas gera trabalho manual.

**Decisão pendente:** se, no caso de e-mail alternativo repetido em vários acessos, o sistema deve sugerir a promoção do novo e-mail ao executivo.

## 3. E-mail igual + telefone diferente

**Atual.** Também não encontra nada na consulta prévia (exige os dois) e cria um novo cadastro; o espelhamento posterior no servidor até deduplica por e-mail, mas o navegador já tratou como novo.

**Proposto.**

- Lead existente: **reaproveitado**.
- Novo telefone: gravado como **telefone alternativo**, nunca no campo principal.
- Telefone antigo: **preservado** — inclusive porque ele é a chave usada pelo relacionamento e pelas mensagens.
- Marcação de conflito: **sim**, divergência de telefone registrada para revisão.
- Quem revisa: o **executivo responsável** pelo cadastro; a gestão vê os casos em aberto.
- Novo lead: **não**.

**Risco.** Se a pessoa realmente mudou de número, as mensagens continuarão indo para o número antigo até a confirmação manual. É intencional: trocar o canal oficial de conversa automaticamente seria perigoso.

**Decisão pendente:** confirmar que a troca de telefone principal permanece **exclusivamente manual**.

## 4. E-mail de um lead + telefone de outro

**Atual.** A regra de decisão já existente (`resolveIdentityMatch`) trata esse caso como **conflito** e não funde nada — mas hoje ela roda com dados do navegador, então na prática quase nunca dispara: o resultado real é a criação de um terceiro cadastro.

**Proposto (mantendo a mesma semântica, agora no servidor).**

- Telefone continua sendo a **chave forte**: sim.
- Lead reaproveitado: **Lead B** (dono do telefone informado).
- Marcação: **os dois cadastros** (A e B) recebem a marca de conflito de identidade, cada um apontando para o outro.
- Merge: **nenhum**.
- Exclusão: **nenhuma**.
- Revisão posterior pelo executivo: **sim**, com os dois cadastros lado a lado e a decisão sempre manual.

**Risco.** É o cenário típico de e-mail digitado errado ou telefone de familiar. Sem revisão humana, o caso fica em aberto acumulando; por isso ele precisa aparecer em uma lista de pendências.

**Decisão pendente:** onde essa fila de conflitos deve aparecer para o executivo (ficha do investidor apenas, ou também um painel de pendências).

## 5. Concorrência / dupla criação

**Atual.** Não há proteção real: o identificador do lead é gerado no próprio navegador, o envio ao servidor é "dispare e esqueça" e não existe índice único por telefone ou e-mail. Dois dispositivos simultâneos criam dois cadastros.

**Proposto — duas camadas, ambas no banco.**

1. **Trava por chave dentro da transação.** Toda a operação (consultar → decidir → criar ou reaproveitar) roda em **uma única função no banco**, que primeiro adquire uma trava exclusiva calculada a partir da chave normalizada (telefone; e-mail quando não houver telefone). A segunda requisição fica bloqueada por milissegundos, e quando entra já enxerga o cadastro criado pela primeira — então ela **reaproveita**, não cria. A trava é liberada automaticamente ao fim da transação.
2. **Rede de segurança estrutural.** Um índice único **parcial**, aplicado somente aos cadastros criados a partir da ativação (uma nova coluna de chave de identidade, preenchida só nos novos registros). Assim, mesmo em falha de aplicação, o banco recusa a segunda inserção. O índice **não** pode ser aplicado ao acervo atual porque os duplicados históricos o violariam — e apagá-los é proibido.

**Riscos.** A trava precisa ser curta (só a decisão e a inserção) para não segurar a entrada do investidor; nada de I/O externo dentro dela. O índice parcial exige uma coluna nova — alteração puramente aditiva, sem tocar em linha existente.

**Decisão pendente:** aprovar a criação da função no banco e da coluna/índice parcial (ambos aditivos).

## 6. Precedência do nome corrigido manualmente

**Atual.** A base de leads do Portal **já possui** um campo de marcações de correção manual (`manual_overrides`), hoje **vazio nos 51 cadastros**. A sincronização externa do CRM **já respeita** esse campo: campos marcados são removidos do pacote de atualização e o valor corrigido é preservado. Porém: (a) a gravação vinda do Portal **não consulta** essas marcações; (b) a tela de edição da ficha **não grava** a marcação ao corrigir o nome. Ou seja, a proteção existe na sincronização externa, mas não no caminho do Portal.

**Proposto.**

- Onde fica registrado: no **mesmo campo de correções manuais** já existente, com quem corrigiu e quando — sem inventar uma estrutura nova.
- Como o sistema sabe: ao salvar a ficha, o campo alterado pelo executivo é marcado como corrigido manualmente.
- Novos acessos/formulários: o nome informado no Portal passa a ser gravado apenas como **nome informado pelo investidor** (histórico/auditoria); o nome exibido continua o corrigido.
- Sincronizações futuras: já são bloqueadas pela regra existente; o caminho do Portal passa a aplicar a mesma verificação antes de gravar.
- Reversível: basta o executivo remover a marcação para voltar a aceitar o valor da origem.

**Risco.** Marcar automaticamente qualquer edição pode congelar campos sem intenção; por isso a marca vale por campo e é reversível.

**Decisão pendente:** confirmar se a proteção vale só para o **nome** ou também para e-mail, telefone e cidade.

## 7. Escopo e preservação dos dados

A implementação proposta:

- não exclui leads — confirmado;
- não funde leads automaticamente — confirmado (conflito é sinalizado, nunca resolvido);
- não altera leads históricos — confirmado (nenhum valor principal é sobrescrito pelo fluxo automático);
- não altera o Portal dos Leads — confirmado;
- não altera a sincronização GreenSales — confirmado;
- não altera CRM, cadência, motor de relacionamento, mensagens, Biblioteca de Conteúdo, templates nem backup — confirmado;
- não cria migração destrutiva — confirmado.

**Alterações fora do "zero banco" que seriam tecnicamente necessárias (não serão feitas sem aprovação):**

1. Uma **função no banco** para a operação atômica de identidade (item 5). Sem ela não existe garantia real contra corrida — apenas mitigação no aplicativo.
2. Uma **coluna nova de chave de identidade** e um **índice único parcial** sobre ela, válidos só para cadastros novos (item 5). Aditivos; nenhuma linha existente é lida, alterada ou recusada.
3. Uma **estrutura para e-mails/telefones alternativos e conflitos** (itens 2, 3 e 4). Pode ser feita sem tabela nova, reaproveitando campos de dados já existentes no cadastro, ou com uma tabela própria — a decidir.

Nenhuma delas remove, funde ou reescreve dado histórico.

### Arquivos que a implementação tocaria (quando autorizada)

`src/components/portal/gateway-overlay.tsx`, `src/lib/portal-leads-sync.ts`, `src/lib/portal-leads.functions.ts` (ampliar a consulta de "e-mail E telefone" para "e-mail OU telefone"), `src/lib/portal-session.ts` (passar a obedecer ao servidor), `src/lib/workspace-lead-edit.ts` (marcar correção manual) e um novo arquivo de função de servidor para o resolvedor de identidade. `src/lib/portal/ownership.ts` é reutilizado **sem alteração**.
