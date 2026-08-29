# Auditoria Final — mapa de estado e correções da próxima rodada

Como você optou por "só auditar agora" com prioridade em **Visual + E0 + Biblioteca/Motor**, este documento é o mapa das 150 perguntas consolidado a partir do código atual, e o escopo mínimo de correção que proponho executar depois da sua aprovação. Classificação dos vídeos fica de fora (será manual, em rodada própria).

## Mapa por bloco

### 🟢 Confirmado certo no código

- Raiz `/` institucional: três cards (Financeira → `/f`, Solar → `/s`, Seguros → `/seg`), origem `g=grupo` preservada no link, sem estatística fabricada.
- `/s` e `/seg` existem e são isolados: formulário próprio, gravam em `group_unit_leads`, sem Gateway, sem `portal_leads`, sem CRM da Financeira, sem disparo automático.
- Não existe `/sol` — apenas `/s` e `/seg` (mais os links personalizados `s/$slug` e `seg/$slug`).
- Princípios Velox já reduzidos a três quadros: Missão, Visão, Valores.
- Biblioteca com taxonomia real do motor e rótulo amigável por etapa, mantendo a chave técnica (`E20` continua `E20`, exibido como "E6 — Apresentação Digital").
- Regra "sem vínculo é sem vínculo": nenhum fallback por grupo, nenhuma sugestão automática, nenhuma IA classificando vídeo; rotação determinística quando há mais de um material.
- E20 gerada apenas dentro do lead (sem botão na Ação do Dia e no CRM), com validade de 7 dias, contagem de acessos e cancelamento da E27 na abertura.
- Login: entra direto — o problema de dupla autenticação em `/f` está encerrado.

### 🔴 Corrigir agora (escopo desta rodada)

1. **E0 — visibilidade no Workspace.** Hoje o disparo é automático e registrado, mas o card não mostra um estado explícito. Adicionar selo "E0 enviada" / "E0 pendente" / "E0 bloqueada" com o motivo legível (fora de janela, sem destinatário, sem versão na Biblioteca), lendo do registro existente — sem criar caminho novo de envio.
2. **Homologação explícita.** Marcar visualmente, na tela onde a mensagem é vista, que o ambiente está simulando o envio (nada sai para a Meta). Registrar no histórico a resposta do provedor e o erro técnico quando houver, e interromper o motor quando o provedor rejeitar.
3. **Biblioteca — cobertura das etapas.** Garantir que E0, E0 V1, E1, E3, E4, E12, E30, V3, V4, R1–R3, RE0–RE3, RF0, RF1, E20 e E27 apareçam sempre na lista (mesmo sem material), com o alerta de "etapa sem conteúdo vinculado". Etapa que não existe no motor não aparece — é o caso de E2, E5 e E7, que não devem ser inventados.
4. **Visão inversa dos vínculos.** Na ficha de cada conteúdo, listar todas as etapas que o utilizam, para você conseguir auditar sem abrir etapa por etapa.
5. **E20 sem versão ativa.** O bloqueio de emissão deve dizer exatamente o que falta (roteiro publicado, mensagem da Biblioteca, destinatário), e a apresentação deve exibir a versão do roteiro usada.
6. **Formulário das unidades.** Hoje os campos não têm obrigatoriedade declarada. Tornar nome, WhatsApp, e-mail, cidade e faixa de investimento obrigatórios, com validação clara e confirmação simples após o envio.

### 🟡 Investigar antes de mexer

- Diferença entre "contato registrado" e "lead atualizado" nos cards e na Jornada: preciso confirmar caso a caso quais eventos ainda aparecem sem serem atividade real do investidor.
- Horários exibidos nos cards e na Jornada: validar amostra real em `America/Sao_Paulo` antes de qualquer ajuste.
- Capítulos 1 e 7 da Apresentação Digital: hoje ficam sem vídeo porque o roteiro está vazio, não por regra. Se devem ser sempre sem vídeo, isso vira regra do roteiro.

### 🔵 Decisão futura (não faço agora)

- Classificação manual vídeo a vídeo, com justificativa registrada (só na documentação, não na interface, salvo pedido contrário).
- Onde e se "+2.000 unidades" volta a aparecer.
- Identidade visual própria para Solar e Seguros (hoje herdam o padrão do Grupo).

## Detalhes técnicos

- Rótulos continuam vindo de `src/lib/relationship/step-labels.ts`; etapas válidas de `src/lib/relationship/step-registry.ts`. Nenhuma etapa nova é criada.
- O selo de E0 lê os registros já gravados pelo motor — sem novo caminho de envio, sem tocar em `lead-intake.server.ts` além de leitura.
- A obrigatoriedade do formulário é validada no cliente e no servidor (`group_unit_leads`), mantendo o isolamento total das unidades.
- Nada de dados reais é alterado: Portal dos Leads e integração GreenSales permanecem intocados.

## Próximo passo

Depois dessas correções, faço uma auditoria final de conferência antes de qualquer novo comando.
