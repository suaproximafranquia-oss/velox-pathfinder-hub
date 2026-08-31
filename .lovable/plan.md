# Auditoria histórica + Arquitetura da Ação do Dia, Agendamentos e Cadência

## PARTE 1 — Resposta à pergunta de auditoria

**Conclusão: não há evidência de nenhuma mensagem real entregue pela API oficial da Meta em nenhum momento — nem antes, nem depois da trava.** A conclusão não se apoia na trava recém-criada; apoia-se nos registros abaixo.

**Provas verificadas**

1. As credenciais da Meta nunca existiram neste projeto. O cofre de segredos contém 8 segredos e **não há `WHATSAPP_TOKEN` nem `WHATSAPP_PHONE_NUMBER_ID`**. Sem elas o provedor oficial não consegue autenticar na Graph API — qualquer tentativa retorna erro antes de sair.
2. O registro do motor (1.979 ciclos desde 22/08) tem apenas três tipos de evento: `ciclo_motor`, `e0_bloqueada` (524x) e `etapa_simulada` (19x). **Não existe um único `etapa_enviada`.**
3. Cada mensagem gravada tem, na linha do tempo, o motivo da não-entrega:
   - 13 registros (29/08 a 31/08): "Entrega externa pendente: Template oficial da Meta para a E0 não cadastrado";
   - 2 registros (28/08): "Entrega externa pendente: Canal oficial do WhatsApp não configurado para este ambiente";
   - 72 registros anteriores: marcados explicitamente como simulados ("Meta não acionada").
4. Não há nenhum identificador de mensagem devolvido pela Meta em nenhuma tabela; `whatsapp_validations` está vazia (0 linhas).
5. Único caso que merecia checagem: 22/08 13:06 UTC, lead `ld_mt4b3v1ybsb4`, mensagem manual do CRM que gerou o texto "Template aprovado enviado — janela reaberta". Esse texto é otimista: é escrito pela interface **antes** de confirmar entrega, e naquela data as credenciais também não existiam. Não é evidência de entrega.

**O disparo simultâneo das 10:51 (13:51 UTC) — causa identificada**

Não foi desbloqueio, nem retry, nem envio real. Foi **fila represada por um job travado**:

| Hora (UTC) | Evento |
|---|---|
| 13:24 e 13:30 | sincronizações OK, 0 boas-vindas |
| 13:30 / 13:35 | 2 leads marcados `e0_bloqueada` — "Lead sem executivo responsável definido" |
| 13:35:00 | execução do cron **trava em RUNNING** e nunca finaliza |
| 13:36–13:50 | nenhuma execução: a proteção antiabandono de 15 min impede execução concorrente — a fila acumula |
| 13:45:47 | leads recebem vínculo de executivo (deixam de estar bloqueados) |
| 13:51:01 | a trava de 15 min expira, o cron roda e processa **`welcome_sent_count: 12`** de uma vez |
| 13:51:07–13:51:16 | as 12 mensagens E0 são gravadas em sequência (~0,7s cada), todas com entrega externa pendente |

Ou seja: **fluxo** = primeiro contato (E0) dentro do job `portal-crm-sync-automatico` (cron a cada minuto); **etapa** = E0; **leads** = `gs_58744, 58749, 58756, 58771, 58779, 58787, 58792, 58799, 58808, 58815, 58823, 58827`; **provider** = nenhum (registro local, sem entrega). Leads mais recentes continuaram esperando porque ainda estavam em `e0_bloqueada` por falta de executivo responsável (o último caso é `gs_58846`, 15:20 UTC).

Isso confirma três defeitos estruturais que a nova arquitetura precisa eliminar: fila sem visibilidade, execução em lote sem espaçamento e ausência de registro por ação individual.

---

## PARTE 2 — Arquitetura recomendada (nada implementado nesta etapa)

### 1. Como encaixar sem conflitar com o motor atual

Separar em três camadas com responsabilidades exclusivas:

```text
DECISÃO (motor)        →  PLANEJAMENTO (agenda de ações)  →  EXECUÇÃO (Ação do Dia)
o que a etapa exige       uma linha por ação, com prazo      o executivo responde o resultado
```

- O motor de relacionamento continua decidindo etapas (E0..E8, R). Ele **deixa de executar** e passa a apenas **materializar uma ação** na agenda.
- Uma tabela única de ações (`action_items`) é o coração: toda ligação, mensagem, reunião e compromisso vira uma linha com estado próprio. A Ação do Dia lê essa tabela e nada mais.
- O envio de mensagem passa a ser um executor da ação, atrás da trava global — que permanece intacta e no mesmo ponto atual.

### 2. Fonte de verdade por informação

| Informação | Fonte única |
|---|---|
| ID do investidor | card do lead no banco (`portal_leads` / espelho CRM) — nunca o nome |
| Ação (ligação/mensagem/reunião) | nova tabela `action_items` |
| Agendamento | tabela de reuniões existente, referenciada pela ação (a ação não duplica o horário) |
| Resultado (atendeu/compareceu/evolução) | `action_items` (campos objetivos) + evento imutável em `action_events` |
| Observação | nota vinculada ao ID, com referência à ação de origem |
| Notes do Executivo | mesma tabela de notas, filtrada por ID do investidor |
| Relatório administrativo | leitura agregada de `action_items` + `action_events` (nunca recontagem por texto) |

### 3. Nunca salvar nota no lead errado

- Toda ação carrega `lead_id` obrigatório e com chave estrangeira; a interface trafega o objeto da ação, nunca o nome.
- Nome do investidor só é usado para exibição; nenhuma busca por nome em gravação.
- Nota criada pela Ação do Dia recebe `lead_id` + `action_id`; sem os dois a gravação é recusada no servidor.
- Segurança: o servidor confere que o executivo tem acesso àquele lead antes de gravar; a gestora enxerga tudo por regra de papel.

### 4. Ações rastreáveis, idempotentes e sem acúmulo silencioso

- **Uma linha por ação**, com chave determinística (lead + etapa + ciclo) — a mesma etapa não pode gerar duas ações.
- **Estados explícitos**: pendente → em execução → concluída / pulada / reagendada / expirada. Nada some por passar da hora: "atrasada" vira apenas ordenação, e a ação continua no topo até ser respondida.
- **Trava por ação, não por job**: hoje um job travado congela a fila inteira. Cada ação passa a ter sua própria reserva com prazo curto; um travamento afeta uma ação, não as 12.
- **Espaçamento**: o executor processa com limite por minuto, evitando rajada de lote.
- **Visibilidade obrigatória**: painel com pendentes, bloqueadas e motivo (por exemplo "lead sem executivo responsável", que hoje só aparece no log interno).
- **Tentativas registradas** na própria ação, com motivo da falha — falha nunca marca como concluída.

### 5. Componentes envolvidos

- Motor/agendador atual: passa a criar ações em vez de executar.
- Fila de primeiro contato dentro do sync: deixa de enviar; apenas enfileira a ação E0.
- Tela Ação do Dia: ampliada, com perguntas objetivas, observação com prévia limitada e reticências, reagendar e pular com justificativa obrigatória.
- Nova área administrativa (Administrador + Larissa): resumo diário, pulos com justificativa, filtro por executivo e busca por ID.
- Notes do Executivo: passa a receber os registros gerados pelas respostas.

### 6. Estruturas de dados sugeridas

Reaproveitar: leads/cards, reuniões, linha do tempo, biblioteca de mensagens, registro do motor.
Criar: `action_items` (ação, tipo, etapa, lead, executivo, prazo, estado, resultado, justificativa, referência à reunião), `action_events` (histórico imutável de cada resposta) e notas vinculadas por ID.
Ajustar: a tabela de tarefas de cadência atual passa a ser origem de dados, não executor paralelo — dois motores ativos ao mesmo tempo não são permitidos.

### 7. Riscos e conflitos com o legado

- Coexistência temporária de dois caminhos de execução (tarefas de cadência atuais x novas ações). Mitigação: migração única, com desligamento do caminho antigo no mesmo passo.
- Leads sem executivo responsável continuam bloqueando E0; a nova arquitetura torna isso visível, mas a regra de origem do responsável não muda.
- Reagendamento precisa de regra clara para não gerar ação duplicada da mesma etapa.
- Relatório precisa distinguir "resultado negativo" (vermelho) de "pulo" (categoria própria) — são dimensões diferentes.

### 8. Decisões necessárias antes de implementar

1. Ação pendente não respondida no dia: rola para o dia seguinte ou expira e vira pendência auditada?
2. Reagendar reunião: cria nova reunião e encerra a ação atual, ou mantém a mesma reunião com novo horário?
3. Mensagem de cadência: pode ser pulada com justificativa, ou é sempre obrigatória (o texto atual sugere obrigatória)?
4. Limite de caracteres da prévia da observação (sugestão: 140).
5. Escopo da gestora: leitura total com auditoria, ou também poder de intervir em ações de outros executivos?
6. Ligações: registrar duração/horário real ou apenas o resultado objetivo?

### 9. Segurança

A Global WhatsApp Safety Lock permanece intacta e continua sendo a última barreira antes da Graph API. A nova arquitetura executa mensagens em modo registrado/simulado; nenhum ponto novo fala com a Meta e nenhum controle de liberação é criado na interface.
