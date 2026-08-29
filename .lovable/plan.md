# Refino final — Motor de Relacionamento (Etapas 1/2/3)

Consolidação das decisões das Baterias 1 e 2 da auditoria. **Aguarda a Bateria 3 para o diagnóstico final e o comando definitivo** (item 200). Nada será implementado que não esteja explicitamente decidido aqui.

## Decisões travadas pelo usuário (não reabrir)

1. **Janelas de horário (oficial):**
   - E0 (primeiro contato): **07:00–22:30** — janela própria, mantida.
   - Demais automações do motor: **09:00–21:00**.
   - Fechamento operacional: **22:00**. Sem unificação. Fuso único: America/Sao_Paulo.
2. **Rotação de conteúdo:** escopo **por lead** (como está hoje). O lead nunca repete o mesmo conteúdo enquanto houver alternativa; esgotado o pool, nova volta a partir do primeiro.
3. **E0 sem WhatsApp válido do executivo:** **bloquear a E0 inteira** — nada é enviado até o número existir. Registrar o bloqueio explicitamente (qual botão/destino faltou).
4. **Feriados no dia útil (E27/Finalização):** **nacionais + estaduais de SP**, lista configurável na aplicação (`nonBusinessDays`), editável pelo administrador.

## Refinos confirmados nas respostas da Bateria 2

### Biblioteca e verdade dos conteúdos
- Biblioteca ativa = verdade absoluta de produção; Word vira semente histórica.
- Após a consolidação manual, desativar o botão "Importar Word oficial"; edição manual nunca pode ser sobrescrita por importação (trava).
- Preservar versão anterior; exibir versão ativa, autor e data da última alteração.
- Rótulo e texto editáveis de forma independente; renomear não cria versão.
- Etapa sem texto: selo "aguardando texto oficial" + envio impossível.
- Aviso de conteúdo órfão (ativo sem vínculo) + indicador "usado pelo motor / não usado".

### Etapas e nomenclatura
- Rótulo visual editável sobre chave técnica fixa (E3 aparece como "E2 — nome", etc.).
- Chave técnica visível na administração para auditoria; executivo comum vê só o rótulo.
- E20 = "E6 — Apresentação Digital"; FINALIZAÇÃO = "E7 — [nome a definir pelo usuário]".
- Separação visual na Biblioteca: etapas de cadência × eventos paralelos; área própria de fechamento (E20/E27/FINALIZAÇÃO).
- E2/E5/E6/E7 nunca reaparecem como chaves técnicas; impedir criação de chave duplicada.

### Rotação e consumo
- Pools confirmados: E1 (5), E3 (6), R2 (4), V3 (2).
- `usage_count`/`last_used_at` passam a refletir uso real: só após envio efetivamente registrado; simulado/bloqueado/falha técnica não contam; retry conta uma vez.
- Histórico por lead mostra exatamente qual conteúdo foi entregue; conteúdo desativado continua visível no histórico.
- Reordenação manual: via prioridade explícita por conteúdo (não drag-and-drop).

### E0 e Meta
- Só API oficial em produção; template único; parâmetros de botão por lead; destinos congelados no snapshot.
- Sem WhatsApp válido: E0 bloqueada (ver decisão 3). Número institucional jamais volta como fallback; `executive_profiles.whatsapp` é a única fonte.
- Registrar explicitamente qual botão foi removido por falta de destino.

### Resposta automática
- Texto oficial deve deixar claro que o número institucional é só para envio inicial e direcionar ao executivo responsável.
- Link do WhatsApp resolvido dinamicamente com o responsável **atual** no momento da resposta (confirmar na Bateria 3 se deseja congelar).
- Entrada própria na Biblioteca, editável e versionada; inativa bloqueia. Limites atuais mantidos (1/24h, máx. 2, reset 30 dias, depois silencia).

### E20 / E27 / Finalização
- E20 manual, reutiliza ocorrência vigente, nova emissão fecha a anterior, validade 7 dias, `first_opened_at` + `open_count` + user agent; acessos individuais com data/hora visíveis. (IP: pendente — usuário não decidiu; não registrar por ora.)
- Presença 15 min só do servidor, compondo atividade do Portal; sem estado paralelo no navegador.
- E27 automática no `checkpoint_due_at`; FINALIZAÇÃO no dia útil seguinte (com feriados — decisão 4).
- Fuso oficial do fechamento passa a ser explicitamente America/Sao_Paulo (hoje `nextBusinessDay` usa UTC por coincidência).
- Sem texto oficial: duty permanece bloqueada e a Ação do Dia mostra "bloqueada — texto oficial ausente" (visível, não oculta — confirmar na Bateria 3).
- OPORTUNIDADE: cancela E27/Finalização, fecha ocorrência E20, executivo assume, timeline registra encerramento, imediato na mudança + reconciliação no tick.
- **`close_reason` padronizado; chave terminal aceita `"oportunidade"` e `"oportunidades"` na transição; os 36 registros históricos são preservados intocados.**

### Ação do Dia
- Ponto único de orientação operacional; tipos claramente rotulados; botão "copiar mensagem" (copiar NÃO conclui — só confirmação explícita).
- Tela somente leitura; execução segue no motor.
- E20 manual não aparece como obrigação; E27/Finalização aparecem quando devidas; colapso por lead com precedência Agenda/Reunião > Mensagem > Ligação; mostrar motivo do rebaixamento; filtros por tipo.

### Jornada no CRM
- Remoção apenas visual da aba "Jornada do Investidor" na ficha do CRM; agregador backend permanece; nenhum evento deixa de ser registrado; componente removido depois de comprovada a ausência de consumidor.

### Reset de homologação
- Obrigatório antes da homologação final; escopo somente homologação/leads TEST-*; Portal dos Leads, GreenSales e snapshots reais intocáveis; relatório antes/depois com tabelas alteradas e preservadas; reset em comando separado, sem alteração de código junta.

### Legados e limpeza
- Remover: botão morto de retryCrmWelcome, stubs `processWelcome`/`retryCrmWelcome`, imports mortos, telefones repetidos de `SEED_USERS`, `src/lib/responsible-executive.ts` do caminho do motor (manter onde o login/WhatsApp flutuante ainda usam, ou migrar esses pontos).
- Envio manual do CRM com `CRM_TEMPLATES`: pendente — usuário decide na Bateria 3 se migra tudo para a Biblioteca.

### Segurança do motor
- Etapa desconhecida em runtime: bloqueio explícito + log com a etapa recebida; nunca envia.
- Erro por lead não para o motor; retry 3 tentativas; retry idempotente; webhook duplicado = um registro; identificador técnico rastreável em todo envio.

### Homologação
- 100% simulado primeiro; habilitação real em etapa separada; Lovable proibida de habilitar produção real durante o refino; template Meta e números reais cadastrados pelo usuário; sistema funciona em homologação sem eles; snapshot da E0 permite conferir destinos escolhidos.

### Regras críticas (181–200)
- Biblioteca vence qualquer arquivo/comentário antigo; comportamento testado vence documentação; regras de horário conflitantes param e exigem decisão; OPORTUNIDADE nunca ressuscita cadência; histórico congelado em redistribuição; snapshot nunca recalculado; conteúdo histórico nunca apagado fisicamente; versão nunca sobrescrita; retry nunca duplica; novo ciclo legítimo pode reenviar conteúdo antigo.
- "Excluir" é temporário para organização manual; depois vira só "desativar".

## Itens ainda pendentes (resolver na Bateria 3 ou no comando final)
1. Congelar ou resolver dinamicamente o responsável na resposta automática (itens 65/66).
2. Duty bloqueada por falta de texto: visível com aviso × oculta (itens 94/95).
3. Envio manual do CRM migra para a Biblioteca ou permanece com templates fixos (itens 158–160).
4. Nome oficial de FINALIZAÇÃO ("E7 — ...").
5. Registro de IP nos acessos E20 (item 80).

## Bloqueantes técnicos da Bateria 1 (entram no comando de refino)
- WhatsApp vazio nos 7 executivos (cadastro pelo usuário; sistema deve exibir a pendência).
- Divergência `"oportunidade"` × `"oportunidades"`.
- E20/E27/FINALIZAÇÃO sem texto oficial (textos vêm do usuário).
- `usage_count`/`last_used_at` sem gravação.
- Feriados ausentes no dia útil.
- Zero testes em e20/closure/opportunity/inbound/presence.
