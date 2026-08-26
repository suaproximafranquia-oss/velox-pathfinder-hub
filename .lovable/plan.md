# Revisão Arquitetural — Portal dos Leads, Cadência Assistida, Ações do Dia, Agenda e Remarketing

Análise apenas. Nada implementado, nenhuma migration, nenhuma alteração de banco.

## 1. Descoberta principal sobre o GreenSales

A "dupla fonte" que você pediu **já é a fonte única hoje** — só não estava explícito.

A sincronização não lê o quadro/CRM: ela lê a **base geral de Leads** (`POST /lead/list`, filtro `allExceptInactive`, 100 por página, `withs: ["Tags","Forms"]`). A tela `adm.greennsales.com.br/velox/leads` é exatamente essa listagem. A "coluna do CRM" é derivada localmente das **etiquetas (Tags)** de cada lead — não existe consulta separada ao board.

Consequências:
- Não há um segundo endpoint de conferência a adicionar; há um **contrato a endurecer** (varredura completa comprovada, resolução de etapa por tag e regra de ausência).
- Um lead que "sumiu da coluna" continua vindo na listagem, apenas sem a tag daquela coluna. Isso é tratável hoje, mas a regra atual de etapa desconhecida precisa de revisão.
- Um lead que sai do escopo do nosso login (redistribuído) some da listagem inteira — hoje isso vira a coluna local `nao_localizado`, e só depois de uma varredura **comprovadamente completa** (`scan-completeness`); qualquer página vazia ou total incoerente **aborta** a reconciliação. Nenhum lead é apagado (blindagem por trigger no banco).

## 2. O que já existe

- Varredura completa da base a cada ciclo, sem parada precoce (corrigido no caso Marcelo).
- Sincronização periódica real: `pg_cron` a cada **1 minuto** chama a rota pública; o agendador só executa se passou o intervalo de `crm_automation_settings.sync_interval_minutes` (hoje 5 min) e bloqueia execução concorrente (trava de 15 min).
- Reconciliação diária conservadora + blindagem contra exclusão + log de auditoria.
- Fila de ligações ("Ligações do Dia") com tentativas L2/L3/L4 + 4ª tentativa a ~7 dias, desfecho SIM/NÃO, dias úteis e feriados (`NON_BUSINESS_DAYS` vazio hoje), ancoragem na data real da tentativa.
- Motor de mensagens completo (E0/E0_V1/E1/E3/E4/E12/E30, V3/V4, R1–R3) com estado persistido, fila, decisões e auditoria.
- E0 automática com janela operacional e fila de adiadas (retomada às 07:00).
- Tratamento de nome já conservador: sem confiança no nome → "caro investidor"; base de nomes conhecidos; sem inventar acento.
- Engajamento real do Portal (sessões, retornos, tempo ativo, módulos, primeiro acesso) — já é o insumo natural do reengajamento assistido.
- Token assinado do investidor (HMAC, validade 30 dias) — base pronta para o link personalizado.
- Remarketing isolado com Campanhas e Conversas.

## 3. O que muda de fato (o núcleo da sua proposta)

1. **Inverter o modelo de mensagens**: hoje o motor **dispara**; você quer que ele **prescreva**. E0 permanece automática; E1 em diante viram ação assistida (mensagem pronta + copiar + registro do envio). Isso não exige um motor novo — exige um **modo de execução** por etapa (`AUTO` | `ASSISTIDA`) e um despachante que, em modo assistido, cria uma Ação do Dia em vez de enviar.
2. **"Ligações do Dia" → "Ações do Dia"**: hoje a fila é calculada só sobre ligações e só sobre etapas `zero_contato`/`frio`. Vira uma fila unificada de ações tipadas (ligação, mensagem assistida, retorno solicitado, agendamento, videochamada, reengajamento), com prioridade por horário.
3. **Calendário**: hoje só domingo/sábado são pulados (via dias úteis). Entram: segunda-feira sem ações antigas, feriados populados e a regra de **preservar o intervalo lógico** em vez de empurrar tudo um dia.
4. **Registro de ações**: hoje existe `crm_lead_events` e o desfecho SIM/NÃO. Falta o vocabulário completo (caixa postal, número inválido, retorno solicitado, agendamento, observação) e a leitura consolidada "o que já fiz com essa pessoa".
5. **Agenda de prioridade**: não existe. Precisa nascer (compromissos, ocupação, conflito, painel lateral global). `portal_meetings` existe, mas é agenda de reuniões com investidor via Google — não serve como agenda operacional de horários ocupados sem extensão.
6. **Retorno solicitado com interpretação de linguagem**: não existe.
7. **Link personalizado com validade de 7 dias**: o token existe com 30 dias e sem rota curta; precisa de rota curta + TTL por finalidade + expiração para a home.
8. **Remarketing → aba Leads + identificação de dono**: não existe; hoje conversas de remarketing são deliberadamente desconectadas do CRM.

## 4. Riscos que já vejo

- **Dois motores prescrevendo a mesma coisa**: a fila de ligações e o motor de relacionamento são independentes. Unificar em "Ações do Dia" sem um dono único de fila recria o problema já vivido (E0 repetida). A fila precisa de **uma chave de idempotência por lead+etapa+ciclo**.
- **Desligar disparo automático de E1+** muda o significado de `executed_steps`: hoje "executado" = enviado. Passará a existir "prescrito, não executado". Sem separar os dois campos, o histórico antigo fica ambíguo.
- **Segunda-feira pulada** pode empurrar o ciclo inteiro e, com sábado e feriado, um ciclo de 5 etapas pode passar de 2 semanas. Precisa de teto explícito.
- **Interpretação de linguagem natural** para "me liga daqui 20 min" nunca deve agendar sozinha: sugerir horário e exigir um clique de confirmação.
- **Remarketing conhecer o CRM** quebra o isolamento atual. Aceitável se for **somente leitura** e nunca criar/mover lead.
- **Meta/WhatsApp**: reduzir automação diminui risco. O risco restante é o executivo enviar manualmente fora de janela de 24h sem template — o sistema deve sinalizar, não bloquear o humano.

## 5. Perguntas que precisam de resposta antes do comando definitivo

Vou fazer as 4 mais bloqueantes no chat. As demais, para você responder em bloco:

**Cadência e ciclo**
1. Quantas ligações e quantas mensagens no ciclo? (sugestão: 4 ligações + 3 mensagens assistidas + E0)
2. Duração máxima do ciclo em dias úteis? (sugestão: 12 dias úteis)
3. Quantas ações por dia por lead (manhã/tarde) e quantas ações totais por executivo por dia?
4. Segunda-feira: bloqueia **todas** as ações antigas ou só as de cadência sem hora marcada (retorno solicitado e agendamento passam)?
5. Feriados: lista nacional fixa, + estadual/municipal de qual cidade?
6. "Preservar o intervalo": quando uma data é pulada, o próximo passo conta a partir da **data prevista original** ou da **data real de execução**?

**Ações e registro**
7. Lista final de desfechos permitidos.
8. Pular/adiar ação: exige motivo? Conta como tentativa?
9. Ação não executada no dia: some, acumula como atrasada ou expira depois de N dias?

**Agenda**
10. A agenda é por executivo, compartilhada com o time de expansão, ou as duas visões?
11. Duração padrão de cada compromisso (30 min?) e horário comercial de referência.
12. Deve sincronizar com o Google Calendar já integrado, ou viver só no Portal?

**Link personalizado e acesso**
13. Domínio final do link curto e o que acontece após 7 dias (home do Portal? página "link expirado"?).
14. Expira por tempo, por número de acessos, ou pode ser renovado pelo executivo?

**Remarketing**
15. A aba Leads mostra apenas contatos de campanha ou também o cruzamento com o CRM?
16. Quando o telefone já pertence a um executivo, o remarketing pode conversar mesmo assim, ou só exibir "pertence ao Milton" e bloquear?

**Escopo do comando definitivo**
17. Implementação em uma entrega única ou em blocos (1: sincronização/confluência; 2: Ações do Dia + cadência assistida; 3: agenda + retorno solicitado; 4: link + reengajamento; 5: remarketing)?

## 6. O que eu recomendo não fazer

- Não criar um segundo cliente de API para `/velox/leads`: é a mesma origem já consumida.
- Não deixar a IA agendar sozinha a partir de texto livre.
- Não permitir que o Remarketing escreva no CRM em nenhuma hipótese.
- Não desligar o motor de mensagens: convertê-lo em prescritor preserva todo o histórico e a auditoria.
