# Segunda Rodada Final — Bloco 2: Identidade e Retorno do Lead (somente diagnóstico)

Nada foi implementado, alterado, migrado ou publicado. Consultas ao banco foram apenas de leitura.

## 1. Regra definitiva de identidade

Chaves: telefone normalizado (chave forte) e e-mail normalizado (chave média). Nome nunca identifica.

| Cenário | Lead reaproveitado | Cria novo? | Conflito | Auditoria | Ação manual |
|---|---|---|---|---|---|
| A. telefone + e-mail iguais | o próprio cadastro | não | não | entrada registrada | não |
| B. só telefone igual | o dono do telefone | não | sim (e-mail divergente) | sim, guarda e-mail informado | revisão para eventual troca de e-mail |
| C. só e-mail igual | o dono do e-mail | não | sim (telefone divergente) | sim, guarda telefone informado | revisão obrigatória (telefone é o canal de conversa) |
| D. ambos diferentes | nenhum | sim | não | criação registrada | não |
| E. e-mail de A + telefone de B | **B** (telefone vence) | não | sim, marcado nos dois | sim, referência cruzada A↔B | sim |
| F. telefone compartilhado por pessoas diferentes | o eleito pelo critério do item 2 | não | sim | sim | sim — só o executivo separa as pessoas |
| G. e-mail compartilhado por pessoas diferentes | desempata pelo telefone; se o telefone não bater com nenhum, trata como C sobre o eleito | não | sim | sim | sim |
| H. telefone inválido/ausente | busca só por e-mail; se achar, reaproveita | cria só se e-mail também não achar | não | sim | não |
| I. e-mail inválido/ausente | busca só por telefone; se achar, reaproveita | cria só se telefone também não achar | não | sim | não |
| H+I (os dois inválidos) | nenhum | **não cria** — formulário recusa | — | tentativa registrada | não |

Regra transversal: nenhum caso funde, apaga ou sobrescreve campo principal. Divergências entram como valor alternativo + marca de conflito.

## 2. Duplicados já existentes

Estado real: 51 cadastros; **2 grupos** de telefone repetido; **0** e-mails repetidos; 1 sem telefone válido; 1 sem e-mail válido.

Critério determinístico recomendado (ordem fixa, sempre a mesma):

1. cadastro com relacionamento comercial ativo (descarta arquivado/só-jornada);
2. maior atividade real recente;
3. **mais antigo por data de criação**;
4. desempate final pelo identificador (ordem estável).

Alternativas consideradas: (a) sempre o mais antigo — simples, porém pode devolver um cadastro abandonado enquanto o executivo trabalha o novo; (b) sempre o mais recente — instável, muda a cada nova entrada; (c) híbrido acima. **Recomendo (c)**, com um reforço decisivo: após a primeira eleição, o vínculo é **fixado** para aquelas chaves, e acessos futuros passam a seguir o vínculo gravado — assim a escolha nunca alterna, mesmo que a atividade mude.

Nenhum duplicado é apagado, fundido ou reescrito; os perdedores ficam apenas apontados como duplicidade para revisão.

## 3. Concorrência / duplo cadastro

Hoje não há proteção: o identificador nasce no navegador, o envio é assíncrono e não existe unicidade por telefone/e-mail no banco — duas abas criam dois cadastros.

Desenho seguro: a sequência consultar → decidir → criar/reaproveitar roda **inteira dentro de uma transação no banco**, que primeiro adquire uma trava exclusiva derivada da chave normalizada (telefone; e-mail quando não houver telefone). A segunda requisição espera milissegundos, entra depois e já enxerga o cadastro criado — reaproveita. A trava cai sozinha ao fim da transação. Como rede de segurança, um índice único **parcial** sobre uma chave de identidade preenchida **somente nos cadastros novos** faz o próprio banco recusar a segunda inserção. O índice não pode abranger o acervo atual por causa dos 2 grupos duplicados históricos.

## 4. Falha de rede ou servidor

Risco real hoje: a restauração a partir do servidor captura qualquer erro e devolve "nada encontrado", e o fluxo segue criando cadastro. Uma instabilidade de 2 segundos vira duplicado permanente.

Recomendação: **bloquear temporariamente**. Diante de erro/timeout, o Portal não cria nada; mostra "não conseguimos confirmar seus dados agora, tente novamente" com nova tentativa automática curta (2 a 3 tentativas com espera crescente). Só há criação após uma resposta conclusiva do servidor. Duplicado é dano permanente; espera de alguns segundos é dano reversível.

## 5. localStorage

Continua responsável por: sessão ativa, token de portal, ponto de retomada da jornada, histórico de navegação e preferências. Deixa de decidir identidade.

Trechos atuais que hoje contradizem a regra e precisariam obedecer ao servidor:

- `gateway-overlay.tsx` — a tela "Bem-vindo novamente" é decidida por `getVisitorIdentity()`, puro localStorage.
- `portal-session.ts` — `findLeadByEmail` e `findLeadByPhone` procuram na lista local do navegador e decidem novo × recorrente.
- `portal-leads-sync.ts` — em erro, devolve nulo e o fluxo assume "novo".
- `portal-identity.ts` — a identidade permanente inteira vive em localStorage.

## 6. Nome do investidor

- Onde é salvo: coluna `name` da base de leads (e cópia local no navegador).
- De onde o Portal lê: da lista local restaurada do servidor / da sessão.
- O formulário pode sobrescrever? **Sim, hoje pode** — a gravação do Portal atualiza `name` sem verificar correção manual.
- Como diferenciar: a base **já possui** o campo `manual_overrides` (hoje vazio nos 51 cadastros) e a sincronização do CRM **já o respeita**, removendo do pacote os campos marcados. Falta apenas (a) a tela de edição marcar o campo ao corrigir e (b) o caminho do Portal consultar a marca antes de gravar.
- Forma mais segura: usar essa mesma estrutura, com autor e data; o nome do formulário passa a ser guardado só como "nome informado pelo investidor" (auditoria). Reversível: remover a marca devolve a precedência à origem.

## 7. GreenSales / CRM

**Sim, o bloco de identidade pode ser implementado sem tocar nessas áreas.** A resolução ocorre no caminho de entrada do Portal, antes da criação do cadastro. Sincronização GreenSales, criação/atualização no CRM, histórico, timeline, relacionamento, cadência e motor de mensagens leem o cadastro já resolvido e não mudam de contrato.

Único ponto de contato indireto: ao reaproveitar em vez de criar, o CRM recebe **menos** cadastros novos — é o efeito desejado, não uma alteração de código. E a precedência de nome (item 6) usa uma regra que o CRM já implementa, sem alterá-la.

## 8. Portal dos Leads

Fora do escopo e **não precisa ser alterado**: formulário, layout, telas, campos, fluxo visual, experiência e regras comerciais permanecem. As mudanças ficam no caminho de entrada do investidor (overlay de identificação e camada de servidor). A única mudança perceptível ao investidor é o comportamento em falha do item 4 (mensagem de nova tentativa em vez de seguir adiante) — se isso for considerado alteração de experiência, precisa da sua aprovação explícita.

## 9. Segurança da consulta pública

Situação atual: a consulta é pública e, ao acertar e-mail **e** telefone, devolve a linha quase inteira — nome, cidade, origem, escopo e **executivo responsável**. Com a regra nova (e-mail **ou** telefone), manter esse retorno seria grave: bastaria um telefone para descobrir nome e executivo de terceiros.

Desenho seguro:

- Enviar: apenas e-mail e telefone normalizados.
- Retornar: apenas um indicador de reconhecimento e um identificador opaco de sessão/token — nada mais.
- Nunca retornar: nome, cidade, executivo, escopo, histórico, mensagens, jornada, estado comercial, nem confirmar "existe cadastro com este telefone" de forma isolada.
- O nome de boas-vindas só aparece **depois** que o token é emitido com os dois dados coerentes — nunca a partir de uma chave só.
- Proteções: limite de tentativas por origem e por chave, resposta de tempo constante para acerto e erro, e registro de tentativas anômalas.

## 10. Token e reidratação

O mecanismo existente serve: o token só é emitido quando e-mail **e** telefone conferem com o cadastro, é guardado por identificador de investidor e há controle para não emitir em duplicidade na mesma aba.

Ajustes necessários e riscos:

- Com identificação por chave única (só telefone ou só e-mail), a emissão precisa aceitar a mesma prova que o resolvedor aceitou — hoje ela exige os dois; caso contrário o retorno reconhece o lead e falha ao emitir o token.
- Token duplicado não é risco: são credenciais válidas por investidor, e o cache é por identificador.
- Sessão apontando para outro cadastro é o risco real, e ele vem do item 12; mitigado por: sessão sempre nasce do identificador devolvido pelo servidor, e troca de identificador descarta a sessão e o token antigos.

## 11. Criação de novo lead

Hoje o identificador nasce no navegador. Deve passar para o servidor: normalização → resolução → criação → identificador, em uma única chamada que devolve o identificador definitivo. Impacto: o overlay deixa de "criar e depois sincronizar" e passa a "pedir e receber"; a sessão local passa a ser construída a partir da resposta. O restante do fluxo (jornada, eventos, token, módulos) continua consumindo o mesmo identificador e não muda.

## 12. Conflito real (e-mail de A + telefone de B)

Tecnicamente seguro: telefone decide a sessão (**B**), os dois cadastros recebem marca de conflito com referência cruzada, nada é fundido, apagado ou sobrescrito, e o executivo revisa depois.

Casos de borda ainda a considerar:

- casal/família com o mesmo telefone e e-mails distintos — o segundo é empurrado para o cadastro do primeiro; só a revisão humana separa;
- pessoa que realmente trocou de número: fica no cadastro certo, mas as mensagens continuam indo para o número antigo até a confirmação manual;
- e-mail digitado errado que coincide com o de outro investidor real;
- lead histórico arquivado que passa a ser o eleito ao voltar pelo telefone;
- cadastros de teste (`TEST-*`) e leads sem telefone válido devem ficar fora da elegibilidade de reaproveitamento.

## 13. Telefone como chave forte

A regra "somente dígitos + últimos 11" **não é consistente hoje**. Divergências reais encontradas:

- `src/lib/portal-identity.ts` — dígitos + últimos 11 (regra pretendida);
- `src/lib/portal-leads.functions.ts` — mesma regra, repetida manualmente em três lugares distintos (consulta, dedupe e comparação);
- `src/lib/portal-session.ts` — compara **todos os dígitos**, sem cortar em 11: "11999999999" e "5511999999999" são tratados como pessoas diferentes;
- `src/lib/greensales/normalize.ts` — regra própria: aceita 10 a 13 dígitos e devolve com prefixo "+55" quando aplicável;
- `src/server/portal-token.server.ts` — possui sua própria comparação de telefone.

Recomendação (não executada): uma única função compartilhada de normalização, usada por todos esses pontos.

## 14. E-mail como chave

Mais consistente, porém não único: `trim` + minúsculas aparece repetido em pelo menos quatro arquivos (overlay, gravação, consulta e identidade local), cada um com sua própria linha. Validação de formato só existe no overlay e no normalizador do GreenSales; a consulta do servidor apenas rejeita vazio. Vazio é tratado como "sem chave" na maioria dos pontos, mas a gravação aceita e-mail em branco. Comparação no banco é por igualdade exata da coluna, apoiada em índice sobre a versão minúscula — coerente, desde que a gravação sempre normalize (hoje sim, no caminho do Portal).

## 15. Índices / performance

Já existem em `portal_leads`: chave primária, índice por e-mail minúsculo, por escopo+data, por executivo, por executivo+estado, por data de criação, único parcial por origem externa e parcial de lotes de teste.

Consultas que o resolvedor usaria: busca por e-mail normalizado (**coberta** pelo índice existente) e busca por telefone normalizado (**não coberta** — hoje o telefone nem é filtrado no banco, o corte dos últimos 11 dígitos é feito em memória).

Com 51 cadastros, nada disso é problema de desempenho — uma leitura completa da tabela é instantânea. A necessidade de índice por telefone é **de correção futura e escala**, não de performance atual. Um índice **não único** sobre a expressão do telefone normalizado seria suficiente para a consulta, é puramente aditivo e não altera, valida nem rejeita nenhum dado existente. O índice **único** só é necessário como trava anticorrida e, nesse caso, obrigatoriamente parcial (só cadastros novos).

## 16. Migration

Sem migration é possível cobrir: consulta por e-mail ou telefone no servidor, critério determinístico, precedência de nome (o campo já existe) e mudança de responsabilidade do localStorage. Ou seja, a maior parte do bloco.

Migration realmente necessária apenas para dois pontos:

1. **Função no banco** para a operação atômica de identidade — sem ela não existe garantia real contra corrida, apenas mitigação. Aditiva; não toca dados.
2. **Coluna de chave de identidade + índice único parcial** (só para cadastros criados a partir da ativação) e, opcionalmente, **índice não único por telefone normalizado**. Aditivos; preservam 100% dos dados; nenhum registro histórico é lido, alterado ou recusado.

Estrutura de e-mails/telefones alternativos e marcas de conflito pode ficar em campo de dados já existente no cadastro — sem tabela nova, se preferirem o mínimo de alterações.

## 17. Testes de aceite

1. Mesmo telefone + mesmo e-mail → reaproveita o cadastro; nenhum novo; jornada restaurada.
2. Mesmo telefone + e-mail diferente → reaproveita o dono do telefone; e-mail novo salvo como alternativo; e-mail principal intacto; conflito registrado.
3. Mesmo e-mail + telefone diferente → reaproveita o dono do e-mail; telefone novo como alternativo; telefone principal intacto; conflito registrado; pendência para o executivo.
4. Ambos diferentes → cria exatamente um cadastro novo; sem conflito.
5. E-mail de A + telefone de B → sessão em B; conflito nos dois; nenhum merge; nenhuma exclusão.
6. Navegador normal → reconhecimento vindo do servidor, não do cache.
7. Aba anônima, mesmos dados → reconhece o mesmo cadastro; nenhum novo.
8. Outro navegador → idem.
9. Outro dispositivo → idem.
10. Duas entradas simultâneas com os mesmos dados → exatamente um cadastro; a segunda reaproveita.
11. Servidor indisponível → nada é criado; mensagem de nova tentativa; ao voltar, reconhece corretamente.
12. Nome corrigido pelo executivo e novo acesso com o nome antigo → prevalece o corrigido; o informado fica só na auditoria.
13. Duplicado histórico (os 2 grupos de telefone existentes) → sempre o mesmo cadastro eleito em 3 acessos seguidos; os outros intactos.
14. Telefone inválido → busca só por e-mail; sem e-mail válido, criação recusada com mensagem clara.
15. E-mail inválido → busca só por telefone; sem telefone válido, criação recusada.

Complementares: a consulta pública nunca devolve nome/executivo de terceiros (item 9); os 51 cadastros continuam existindo, sem exclusão nem fusão.

## 18. Conclusão

**A) Confirmado.** Duplicados atuais: 2 grupos por telefone, 0 por e-mail. Não há unicidade por telefone/e-mail no banco. A consulta atual exige e-mail **e** telefone e devolve dados sensíveis. A decisão novo × recorrente ainda passa pelo navegador. O campo de precedência manual já existe e já é respeitado pela sincronização do CRM, mas está vazio e não é preenchido pela tela de edição. A normalização de telefone diverge entre cinco pontos do código.

**B) A decidir por vocês.** (i) ordem de desempate do item 2; (ii) bloquear a criação em falha de servidor (item 4) — muda levemente a experiência; (iii) proteção manual só do nome ou também de e-mail/telefone/cidade; (iv) autorização da função no banco e do índice parcial (item 16); (v) onde a fila de conflitos aparece para o executivo.

**C) Pode ser implementado com segurança.** Resolvedor de identidade no servidor por e-mail **ou** telefone; critério determinístico com vínculo fixado; retorno mínimo e seguro na consulta pública; identificador gerado no servidor; localStorage rebaixado a cache; precedência do nome corrigido; unificação da normalização de telefone/e-mail.

**D) Não tocar.** Portal dos Leads (formulário, telas, campos, regras comerciais), sincronização GreenSales, CRM, cadência, motor de relacionamento, mensagens, Biblioteca, templates, backup e todo o acervo histórico — nenhuma exclusão, fusão ou reescrita.

**E) Prontidão.** Tecnicamente sim: o bloco está maduro para implantação assim que os cinco pontos de (B) forem decididos. Recomendo implantar em duas etapas: primeiro o resolvedor no servidor com retorno seguro e localStorage como cache; depois a trava anticorrida no banco e a precedência do nome.
