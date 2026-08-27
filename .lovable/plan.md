# Auditoria Final de Pré-Implementação — Bloco 2: Identidade e Retorno do Lead

Sem implementação. Abaixo, o que já está fechado e as decisões que ainda faltam. Sete perguntas ao final — nada além disso é necessário para começar.

## 1. Regra de identidade

JÁ DEFINIDO:
- Recorrente = telefone normalizado OU e-mail normalizado coincide com cadastro existente.
- Prioridade: telefone é chave forte; e-mail é chave média.
- Só telefone coincide → reaproveita o dono do telefone; e-mail novo entra como alternativo; conflito registrado; nada sobrescrito.
- Só e-mail coincide → reaproveita o dono do e-mail; telefone novo como alternativo; conflito registrado; canal de conversa continua no telefone antigo até revisão manual.
- Ambos coincidem → reaproveita, sem conflito.
- Nenhum coincide → cria exatamente um cadastro novo.
- Telefone de um e e-mail de outro → vence o telefone; os dois cadastros ficam marcados com conflito cruzado; sem merge.
- Nome nunca identifica.

EM ABERTO: nada.

## 2. Duplicidades históricas

JÁ DEFINIDO:
- Nenhum lead histórico é apagado, fundido ou alterado automaticamente.
- Escolha determinística e, após a primeira eleição, vínculo fixado para não alternar.
- Estado real: 2 grupos de telefone repetido, 0 e-mails repetidos.

EM ABERTO:
- **(P1)** Ordem de desempate: (a) relacionamento ativo → atividade mais recente → mais antigo; ou (b) simplesmente o mais antigo sempre.
- **(P2)** Onde o conflito precisa aparecer: só na ficha do investidor, ou também numa lista de pendências para a gestão.

## 3. Telefone e e-mail

JÁ DEFINIDO:
- Telefone: só dígitos, comparação pelos últimos 11.
- E-mail: sem espaços, minúsculas; vazio/inválido = "sem chave".
- Telefone ausente/inválido → busca só por e-mail; e-mail ausente/inválido → busca só por telefone; os dois inválidos → criação recusada.
- Divergências reais a unificar: `portal-session.ts` compara todos os dígitos (sem cortar 11), `greensales/normalize.ts` usa regra própria (10–13 dígitos com "+55") e `portal-token.server.ts` compara pelos últimos 8.

EM ABERTO:
- **(P3)** A normalização unificada deve valer também para a comparação do token (hoje últimos 8 dígitos, mais permissiva) e para a entrada do GreenSales, ou o GreenSales fica intocado como está hoje.

## 4. Criação de novo lead

JÁ DEFINIDO:
- Consulta, decisão e criação passam para o servidor, em chamada única que devolve o identificador.
- Anticorrida por trava no banco derivada da chave normalizada, mais índice único parcial só para cadastros novos.
- Operação idempotente: mesma chave → mesmo cadastro.
- Em falha, nada é criado; o Portal pede nova tentativa em vez de seguir adiante.

EM ABERTO:
- **(P4)** Confirmar que a mensagem de "tente novamente" em falha de servidor é aceitável na experiência do investidor (é a única mudança perceptível para ele).

## 5. Sessão e localStorage

JÁ DEFINIDO:
- localStorage vira só cache: sessão, token, ponto de retomada, histórico de navegação e preferências.
- Não decide mais novo × recorrente, identidade nem criação.
- Reidratação: servidor identifica → devolve o mínimo → Portal cria a sessão a partir da resposta; troca de identificador descarta sessão e token antigos.

EM ABERTO: nada.

## 6. Precedência do nome

JÁ DEFINIDO:
- Nome corrigido pelo executivo nunca é sobrescrito pelo formulário.
- Registro na estrutura já existente de correções manuais (hoje vazia), que a sincronização do CRM já respeita.
- Nome do formulário passa a ser guardado apenas como "informado pelo investidor", para auditoria.

EM ABERTO:
- **(P5)** A proteção manual vale só para o nome, ou também para e-mail, telefone e cidade.

## 7. Segurança

JÁ DEFINIDO:
- Consulta pública devolve apenas reconhecimento e credencial de sessão. Nunca nome, cidade, executivo, escopo, histórico, mensagens ou jornada.
- Nome de boas-vindas só depois do token emitido com prova coerente.
- Limite de tentativas por origem e por chave, resposta de tempo constante, registro de tentativas anômalas.
- Hoje a consulta devolve nome, cidade e executivo — isso será fechado.

EM ABERTO:
- **(P6)** Com identificação por chave única, o token pode ser emitido quando só o telefone confere (só e-mail é prova mais fraca), ou deve continuar exigindo os dois — neste caso o retorno por e-mail apenas reconhece e pede o telefone para liberar a jornada.

## 8. Integrações

JÁ DEFINIDO: sem alteração em Portal dos Leads, GreenSales, CRM, cadência, mensagens, motor de relacionamento, Biblioteca, templates e backup.

Dependências indiretas a preservar: emissão de token, gravação de eventos de jornada por identificador, roteamento por link personalizado do executivo, regra de escopo "redistribuição nunca é rebaixada", blindagem contra exclusão de leads e a precedência de campos manuais já usada pelo CRM.

EM ABERTO:
- **(P7)** Ao reaproveitar um cadastro que chega por link de outro executivo, confirma-se a regra atual (dono permanece, nova entrada vira evento) — sem alteração?

## 9. Critérios de aceite

1. Outro navegador, mesmos dados → mesmo cadastro, nenhum novo.
2. Outro dispositivo / aba anônima → idem.
3. Telefone igual (e-mail diferente) → nenhum cadastro novo; e-mail novo como alternativo; conflito registrado.
4. E-mail igual (telefone diferente) → nenhum cadastro novo; telefone novo como alternativo; conflito registrado.
5. Telefone de um e e-mail de outro → sessão no dono do telefone; conflito nos dois; nenhum merge.
6. Dois acessos simultâneos → exatamente um cadastro.
7. Leads históricos → os 51 permanecem; 2 grupos duplicados continuam intactos e o eleito é o mesmo em três acessos seguidos.
8. Mesmo nome com telefone e e-mail diferentes → cadastro novo (nome não identifica).
9. Sessão reidratada → jornada e progresso corretos, apontando para o cadastro certo.
10. Servidor indisponível → nada criado; ao voltar, reconhece corretamente.
11. Consulta pública → não devolve nome, executivo nem histórico de terceiros.

## Perguntas finais (as sete)

P1 — Ordem de desempate entre duplicados: relacionamento ativo primeiro, ou sempre o mais antigo?
P2 — Conflitos aparecem só na ficha, ou também numa fila de pendências?
P3 — A normalização unificada de telefone alcança o token e o GreenSales, ou apenas o caminho do Portal?
P4 — Em falha de servidor, bloquear a criação com pedido de nova tentativa é aceitável?
P5 — Proteção de correção manual só para o nome, ou também e-mail/telefone/cidade?
P6 — Token pode ser emitido com prova por telefone apenas, ou continua exigindo telefone e e-mail?
P7 — Reaproveitamento via link de outro executivo mantém a regra atual de propriedade?

Respondidas essas sete, o Bloco 2 fica sem dúvidas arquiteturais e pronto para autorização de implantação.
