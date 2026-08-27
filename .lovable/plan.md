# Bloco 2 — Identidade e Retorno do Lead: plano de implantação

Decisões fechadas. Nada foi implementado ainda — este é o plano para aprovação.

## Decisões finais

| # | Decisão |
|---|---|
| P1 | Duplicados: elege relacionamento ativo → atividade mais recente → cadastro mais antigo → identificador. Após a primeira eleição, o vínculo é fixado e nunca alterna. |
| P2 | Conflitos aparecem na ficha do investidor **e** em uma fila de pendências para a gestão. |
| P3 | Normalização unificada **apenas** no caminho de identidade do Portal. Token e GreenSales permanecem exatamente como estão. |
| P4 | Falha de servidor: nada é criado; nova tentativa automática curta e, persistindo, aviso pedindo para tentar de novo. |
| P5 | Correção manual protege nome, e-mail, telefone e cidade. |
| P6 | Telefone coincidente basta para reconhecer e emitir o token. |
| P7 | Propriedade do lead: regra atual mantida — o dono permanece, a nova entrada vira evento. |

## O que será construído

**1. Resolvedor de identidade no servidor.** Uma única chamada faz normalização → busca por telefone **ou** e-mail → decisão → criação ou reaproveitamento → devolve o identificador. O telefone é a chave forte; o nome nunca identifica. Sem correspondência, cria exatamente um cadastro. Com correspondência parcial, reaproveita e guarda o dado divergente como alternativo, sem sobrescrever nada.

**2. Proteção contra criação simultânea.** A sequência inteira roda dentro de uma transação com trava exclusiva derivada da chave normalizada, mais um índice único parcial que vale só para cadastros criados a partir da ativação (o acervo histórico não é abrangido, porque tem duplicados legítimos).

**3. Conflitos sinalizados, nunca resolvidos sozinhos.** Telefone de um cadastro com e-mail de outro marca os dois com referência cruzada. Nenhum merge, nenhuma exclusão, nenhuma reescrita. Tudo vai para a fila de pendências da gestão.

**4. localStorage rebaixado a cache.** Continua guardando sessão, token, ponto de retomada, histórico de navegação e preferências. Deixa de decidir novo × recorrente. A tela "Bem-vindo novamente" passa a depender da resposta do servidor.

**5. Precedência da correção manual.** Ao editar a ficha, os campos alterados são marcados na estrutura já existente de correções manuais — que a sincronização do CRM já respeita. O caminho do Portal passa a consultar essa marca antes de gravar; o valor do formulário fica registrado apenas como "informado pelo investidor".

**6. Consulta pública blindada.** Passa a devolver só reconhecimento e credencial de sessão. Nunca nome, cidade, executivo, escopo, histórico, mensagens ou jornada, com limite de tentativas e tempo de resposta constante.

## Fora do escopo (não será tocado)

Portal dos Leads (formulário, telas, campos, regras comerciais), sincronização GreenSales, CRM, cadência, mensagens, motor de relacionamento, Biblioteca, templates, backup e todo o acervo histórico — sem exclusão, fusão ou reescrita.

## Detalhes técnicos

- Nova função de servidor de resolução de identidade, chamada pelo overlay de identificação; o identificador deixa de nascer no navegador.
- `src/lib/portal-leads.functions.ts`: consulta passa de "e-mail E telefone" para "e-mail OU telefone", com retorno mínimo.
- `src/lib/portal-session.ts` e `src/components/portal/gateway-overlay.tsx`: passam a obedecer à resposta do servidor.
- `src/lib/portal-leads-sync.ts`: erro deixa de ser tratado como "não encontrado".
- `src/lib/workspace-lead-edit.ts`: grava as marcas de correção manual.
- Migration aditiva: função de resolução atômica no banco, coluna de chave de identidade, índice único parcial (só cadastros novos) e índice não único por telefone normalizado. Preserva 100% dos dados; nenhum registro histórico é alterado ou recusado.

## Testes de aceite

1. Outro navegador, aba anônima e outro dispositivo com os mesmos dados → mesmo cadastro, nenhum novo.
2. Telefone igual e e-mail diferente → sem cadastro novo; e-mail novo como alternativo; conflito registrado.
3. E-mail igual e telefone diferente → sem cadastro novo; telefone novo como alternativo; conflito registrado.
4. Telefone de um e e-mail de outro → sessão no dono do telefone; conflito nos dois; nenhum merge.
5. Dois acessos simultâneos → exatamente um cadastro.
6. Duplicados históricos → os 51 cadastros intactos; o mesmo eleito em três acessos seguidos.
7. Mesmo nome com contatos diferentes → cadastro novo (nome não identifica).
8. Servidor indisponível → nada criado; ao voltar, reconhece corretamente.
9. Nome corrigido pelo executivo → prevalece sobre o formulário.
10. Consulta pública → não devolve nome, executivo nem histórico de terceiros.
11. Sessão reidratada → jornada e progresso corretos no cadastro certo.
