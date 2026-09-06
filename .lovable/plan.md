# Central de Operações /f — fechamento técnico

## 1. Decisões fechadas

- Relatório do que aconteceu na Ação do Dia. Quatro indicadores: ligações efetuadas, mensagens enviadas, reuniões realizadas, pulos.
- Ligação conta como efetuada tenha atendido ou não. Pular não gera ligação.
- Primeiro contato (E0) fica fora da Central.
- Só reuniões concluídas pela Ação do Dia com resultado "compareceu".
- A produção pertence a quem executou.
- Sem gráfico, sem "Ver detalhes", sem atrasados, sem cobrança, sem redistribuição, sem expurgo.
- Colaborador (Marton, Milton, Paulo, Carlos, Talita) abre direto em "Minha operação" e vê só a si.
- Larissa é exclusivamente gestora: visão da equipe, sem operação própria, sem "Minha operação", sem linha na tabela e nunca tratada como autora ou executora de qualquer ação. Consultar um pulo é apenas leitura gerencial — não conclui, não pula, não altera lead nem cadência.
- Thiago é a exceção: administrador com operação própria, alterna entre "Toda a equipe" e "Minha operação".
- Períodos: Hoje, Ontem, Últimos 7 dias, Este mês, Personalizado (sem datas futuras). Dias sem produção aparecem com zero.
- Pulos clicáveis abrem a relação de leads pulados.

## 2. Fontes de dados confirmadas

| Indicador | Registro oficial | Executor | Momento | Confiável hoje |
| --- | --- | --- | --- | --- |
| Ligações efetuadas | tarefa de cadência do canal ligação com situação concluída | `completed_by` (usuário) | `completed_at` | Sim |
| Mensagens enviadas | registro `acao_do_dia_mensagem_registrada` com resultado "enviada" | `actor` | `details.at` | Sim, com o filtro de resultado |
| Reuniões realizadas | registro `acao_do_dia_reuniao_resolvida` com resultado "compareceu" | `actor` | `details.at` | Sim |
| Pulos | registro `acao_do_dia_pulada` | `actor` | `details.at` | Sim |

Verificações feitas:

- A conclusão da ligação grava uma única linha por tentativa (chave lead + canal + ciclo + etapa), portanto repetir a confirmação sobrescreve em vez de duplicar.
- O registro de mensagem sempre é gravado, mas carrega o resultado da execução: "enviada" quando a etapa foi realmente concluída agora e "registrada" quando foi repetição. Ele também guarda o identificador da tarefa original, o que permite contar uma vez só.
- O registro de reunião e o de pulo são gravados exclusivamente pelos caminhos da Ação do Dia; nenhuma outra tela produz esses mesmos registros.
- O primeiro contato segue por outro caminho (ação de E0 do Workspace) e nunca gera o registro de mensagem — não há risco de virar produção, e o filtro por tipo de ação serve de segunda barreira.

## 3. Riscos de duplicidade

- Mensagem: confirmar duas vezes gera dois registros; resolvido contando apenas resultado "enviada" e uma ocorrência por tarefa original.
- Reunião: resolver o desfecho duas vezes geraria dois registros; resolvido contando uma ocorrência por reunião.
- Pulo: pular a mesma ação em dias diferentes gera dois registros — e isso é correto, são dois pulos. No mesmo dia, a contagem é única por ação e data operacional.
- Ligação: sem risco, pela chave única da tarefa.

## 4. Riscos de contagem incorreta

- **Identidade do executor mistura duas chaves.** As ligações guardam o usuário de login; os registros de relacionamento guardam o executivo quando existe e caem no usuário de login quando não existe. A Central precisa reconhecer as duas formas e converter ambas para o mesmo executivo, senão a mesma pessoa apareceria em duas linhas. Isso é resolvido só na leitura, sem tocar em nada gravado.
- **Registros antigos sem executivo identificado** ficam sem dono; serão agrupados como "não identificado" em vez de atribuídos a alguém.
- **Leads de teste/homologação** não podem entrar na produção real: as mensagens já são filtradas por ambiente de produção; as ligações precisam do mesmo cuidado na leitura.
- Nada é perdido: toda ação concluída pela Ação do Dia deixa um dos registros acima.
- Não é necessária nenhuma alteração na Ação do Dia para a Central ser fiel.

## 5. Permissões e escopo

O servidor já resolve usuário logado, papel (administração, gestão, colaborador) e executivo correspondente pela identidade central existente. A Central usará exatamente isso: o recorte é decidido no servidor a partir da sessão, e o pedido do navegador não carrega identificador de executivo. Um colaborador não consegue, por URL ou parâmetro, ver a operação de outra pessoa.

Perfil de gestão (Larissa): recebe sempre a visão da equipe, sem alternância e sem recorte próprio — mesmo que algum registro antigo a apontasse como autora, ela não aparece como linha de produção. Administração (Thiago): recebe a equipe e pode pedir "minha operação", resolvida pela própria identidade dele no servidor.

## 6. Navegação pelo lead

Será reutilizado o mesmo caminho que o Portal dos Leads e a Ação do Dia já usam hoje: abrir a ficha do investidor pelo identificador oficial do lead, deixando as regras de acesso decidirem o que cada pessoa enxerga. Nenhuma rota nova, nenhuma lógica paralela de localização.

## 7. Períodos, datas e fuso

A aplicação já tem uma definição única de data operacional em São Paulo, usada pela Ação do Dia. A Central usará essa mesma função para agrupar por dia e para montar os períodos, sem criar segunda definição de fuso. Datas futuras ficam bloqueadas no seletor e no servidor.

## 8. Perguntas ainda indispensáveis

PLANEJAMENTO FECHADO — NÃO HÁ MAIS PERGUNTAS INDISPENSÁVEIS.

Respostas finais registradas:

1. Não haverá quinto card. Os quatro indicadores superiores são: Ligações efetuadas, Mensagens enviadas, Reuniões realizadas, Pulos. A coluna "Total" permanece apenas nas tabelas.
2. Quando as regras server-side não permitirem abrir a ficha, o registro do pulo continua visível (investidor, etapa, motivo, horário), sem expor dados não autorizados, e o link é substituído por um aviso "Acesso indisponível".
