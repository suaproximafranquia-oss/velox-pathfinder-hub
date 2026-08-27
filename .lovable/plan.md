# Terceira rodada — arquitetura recomendada (sem implementação)

Nada foi alterado. Abaixo, as respostas técnicas e o desenho proposto para os quatro blocos.

## 1. Identidade do lead — servidor como fonte de verdade

**Como consultar o servidor antes de criar (P1).** Uma server function pública e sem sessão (`resolverIdentidadeDoPortal`), chamada pelo Gateway antes de qualquer `registerLead`. Ela é pública por necessidade — o visitante ainda não tem token — e por isso precisa ser deliberadamente estreita: recebe apenas nome/e-mail/telefone, responde apenas com um veredito e, quando há match, emite o token de portal já existente (`src/server/portal-token.server.ts`). Nunca devolve dados de outro lead: sem token válido a resposta é só `{ status, investorId, token }`, sem nome, sem histórico, sem executivo.

**Resolvedor (P2) — sim, e nesta ordem.** Chaves normalizadas no servidor: e-mail em minúsculas e sem espaços; telefone reduzido a dígitos com no mínimo 10 (telefone vazio nunca casa — regra que já existe na trava da sincronização). Busca: (a) telefone normalizado, (b) e-mail normalizado, (c) cruzamento dos dois. Nome nunca identifica.

**Retorno e criação (P3/P4).** Encontrando lead, o Portal assume aquele `investorId` como retorno, independentemente de navegador ou dispositivo, e reidrata a sessão local a partir do servidor. Não encontrando, aí sim cria — e a criação passa a ser feita pelo servidor, não pelo navegador, para que a checagem e a inserção sejam uma operação só.

**localStorage (P5) — sim, só cache.** Ele continua guardando sessão, ponto de retomada e histórico de navegação, mas perde qualquer poder de decidir "novo x recorrente". A decisão passa a ser sempre a resposta do resolvedor.

**Matriz de conflito (P6):**

| Situação | Comportamento |
|---|---|
| Ambos iguais | Retorno confirmado, sem qualquer registro novo de lead |
| Telefone igual, e-mail diferente | Mesma pessoa (telefone é a chave forte). Reaproveita o lead; grava o novo e-mail como e-mail secundário e registra o fato em auditoria — não sobrescreve silenciosamente |
| E-mail igual, telefone diferente | Mesma pessoa provável (troca de número). Reaproveita o lead e marca `identityConflict` para revisão do executivo; sem merge automático |
| Ambos diferentes | Lead novo |
| Um match por e-mail e outro por telefone, apontando para leads distintos | Conflito real: escolhe o lead do telefone, marca `identityConflict` nos dois e nunca funde registros |

**`resolveIdentityMatch` (P7).** A regra é boa e deve ser preservada — mas ela vive hoje em `src/lib/portal/ownership.ts`, avaliada no navegador sobre o cache local. A recomendação é mover a *decisão* para o servidor reutilizando a mesma função (ela é pura), passando os IDs vindos da consulta ao banco. Nada de reescrever a semântica; muda apenas onde ela roda e sobre quais dados.

**Idempotência e segurança.** Resolução e criação numa única server function; índice único no telefone normalizado para impedir corrida entre duas abas; nenhum lead é fundido ou apagado, jamais — conflito vira sinalização; a rota pública recebe limitação de tentativas por IP, já que responde "existe / não existe" sobre um telefone.

## 2. Primeiro acesso × retorno × engajamento

**Eventos propostos (P1–P3):**

- `portal.acesso` — o investidor abriu o Portal (sessão iniciada/retomada).
- `portal.recurso.acessado` — abriu material, apresentação, calculadora, revista. Carrega o recurso e o detalhe.
- `link.clicado` — clique em URL rastreável, com destino e conteúdo associados.

**Cadeia semântica (P4).** Quatro eventos distintos, nunca colapsados:

```text
mensagem.enviada     → registro do envio (etapa, texto congelado, conteúdo)
mensagem.visualizada → só quando a Meta devolver o status "read"
link.clicado         → passagem pela URL rastreável
recurso.acessado     → chegada efetiva a uma tela do Portal
```

Um clique não implica leitura; um acesso não implica clique (pode ter vindo direto).

**Primeiro acesso após E0 (P5) — correto.** Gera engajamento normalmente, mas não cria item próprio na Jornada: o acontecimento relevante ali já é a E0 enviada. A Jornada ganha, no máximo, um marco "investidor entrou no Portal pela primeira vez", uma única vez na vida do lead.

**Regra do item 6 (P6) — confirmada integralmente**, com uma observação: "resposta do investidor" entra na Jornada como fato relacional e alimenta o engajamento pelo mesmo registro, sem duplicar linha.

**Promoção sem duplicação (P7).** O evento de engajamento é o registro único. A Jornada não copia: ela referencia. Uma interação vira item de Jornada quando marcada como marco (primeiro acesso, acesso à apresentação digital, resposta), e o item de Jornada aponta para o mesmo identificador de engajamento — nunca um segundo registro.

**Agrupamento (P8).** Uma sessão de navegação = **um** item na Jornada:

> "Acessou o Portal e navegou por 6 recursos — 27/08, 14h12 às 14h31."

Expandindo, o executivo vê a lista dos recursos. Cada ocorrência individual continua íntegra na camada de engajamento (e na auditoria), com data/hora própria, alimentando o indicador. A janela de agrupamento acompanha a sessão do investidor, com corte por inatividade.

## 3. Clique em link externo

**Sim para URL intermediária (P1/P2).** Um endpoint público do próprio sistema, do tipo `/r/<token>`, resolve um registro que já contém lead, etapa/mensagem, conteúdo e destino. Ele grava o clique e redireciona (302) para o endereço externo real. O token é opaco e de uso rastreado — não carrega dados do lead na URL.

**Links manuais do executivo (P3) — sim.** Ao inserir uma URL na conversa, o sistema oferece a versão rastreável, vinculada ao mesmo lead e à mensagem. Se o executivo optar pelo link cru, o envio funciona normalmente, apenas sem rastreio.

**Sem quebrar o destino (P4).** O redirecionamento preserva a URL final integralmente, incluindo parâmetros; nada é reescrito no destino. Se o registro do clique falhar, o redirecionamento acontece do mesmo jeito — o rastreio nunca pode impedir o investidor de chegar ao conteúdo. No WhatsApp o preview mostra o domínio intermediário; se isso incomodar, a alternativa é um domínio curto próprio.

**Engajamento (P5) — sim**, com peso maior que um simples acesso, por ser ação deliberada sobre um conteúdo específico.

## 4. Backup — eliminar a dependência do timeout

**Diagnóstico já fechado:** cron correto (`0 * * * *`), `pg_net` corta em 5 s, a captura de ~6 MB passa disso, e não há retry — a hora simplesmente some.

**Arquitetura recomendada (P1–P3):** separar *pedido* de *execução*.

```text
pg_cron (0 * * * *)
   └─ insere a solicitação da hora (chave = hora cheia)   ← rápido, nunca dá timeout
pg_cron (a cada minuto)
   └─ chama a rota de processamento, que:
        · pega a solicitação pendente mais antiga
        · toma um lease com expiração (execução única)
        · captura, grava e valida o snapshot
        · marca concluída
```

A chamada por minuto pode inclusive sofrer timeout no `pg_net`: o processamento continua no servidor e a solicitação só sai de "pendente" quando o snapshot estiver gravado. O relógio deixa de depender da resposta HTTP.

**Retry e idempotência (P4/P5).** A solicitação tem chave única pela hora cheia — duas tentativas nunca geram dois pontos. Lease com expiração impede execução concorrente; um lease vencido devolve a solicitação à fila. Solicitação pendente de horas anteriores é recuperada no ciclo seguinte, então uma hora perdida vira snapshot atrasado e auditado, não um buraco silencioso.

**Sucesso só após gravação (P6) — sim.** O ponto nasce em estado "em andamento" e só é considerado válido depois que a linha existe, o blob foi persistido e o tamanho/contagem confere. Ponto incompleto fica marcado como falho e visível na Central, nunca oferecido para restauração.

**Madrugada e conteúdo idêntico (P7).** Não há razão técnica para gravar pontos idênticos: o hash SHA-256 do payload já existe e o blob já é reaproveitado, então a economia hoje é só de armazenamento. A regra futura pode ser: conteúdo inalterado não cria novo ponto — registra apenas "verificado, sem alteração" sobre o último ponto válido. Isso mantém a garantia de recuperação (o ponto válido continua lá) e limpa a leitura da Central. Recomendo adotar isso **depois** que a fila estiver estável, para não misturar duas causas de ausência de ponto.

## 5. Critério de aceite — como será verificável

- **Identidade:** simular o mesmo e-mail/telefone em navegador limpo e confirmar o mesmo `investorId`; contar leads por telefone normalizado no banco antes e depois.
- **Engajamento:** abrir a ficha pelo executivo e confirmar ausência de evento de lead; navegar por vários módulos como investidor e confirmar um único item na Jornada com as ocorrências detalhadas na camada de engajamento.
- **Clique:** disparar a URL rastreável e verificar o registro com lead, etapa, conteúdo, destino e horário, mais o redirecionamento íntegro.
- **Backup:** conferir uma linha de solicitação por hora cheia, todas concluídas, e a inexistência de lacunas mesmo com timeouts registrados em `net._http_response`.

Nada acima foi implementado. Autorize e eu executo por blocos, começando pelo backup (isolado e sem risco para o Portal dos Leads).
