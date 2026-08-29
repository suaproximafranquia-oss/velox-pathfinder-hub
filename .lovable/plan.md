# Refino final — Biblioteca única, fechamento por Oportunidade e textos oficiais

Três ajustes fechados a partir da auditoria. Nada de texto inventado, nenhuma chave técnica renomeada, nenhum histórico alterado.

## 1. Uma etapa, uma linha na Biblioteca

Hoje a importação do Word criou E2, E5, E6 e E7 como etapas próprias, enquanto o motor executa E3, E4, E12 e E20. São duas representações da mesma etapa.

Correção: o texto do Word passa a viver na etapa técnica correspondente e o nome do Word vira apenas o **rótulo visível**.

```text
Word  ->  chave técnica      rótulo exibido
E2    ->  E3                 "E2 — ..." (nome do Word)
E5    ->  E4                 "E5 — ..."
E6    ->  E12                "E6 — ..."
E7    ->  FINALIZACAO        "E7 — ..."   (fica inativa, sem texto oficial)
E20   ->  E20                "E6 — Apresentação Digital" (mantido)
```

As linhas duplicadas E2/E5/E6/E7 são desativadas (não apagadas), e o texto importado entra como nova versão da etapa técnica — versionamento imutável, a versão anterior permanece consultável. Snapshots já enviados não mudam.

## 2. OPORTUNIDADE encerra o ciclo automático

Quando o lead entra em OPORTUNIDADE:

- a ocorrência ativa da Apresentação Digital é encerrada (`close_reason = oportunidade`);
- checkpoint (E27) e finalização pendentes são cancelados e somem da Ação do Dia;
- fica um registro no histórico dizendo que o executivo assumiu a conversa;
- nada automático é enviado depois disso.

O cancelamento roda tanto no momento da mudança de etapa quanto na varredura do motor, para pegar leads que já estavam em oportunidade.

## 3. Textos oficiais de E20, E27 e Finalização

Essas três etapas continuam **sem texto** até você enviar os oficiais. O que será feito agora:

- a Biblioteca passa a listar as três explicitamente como "aguardando texto oficial", com campo pronto para colar e ativar;
- enquanto estiverem inativas, o motor não envia nada e registra o motivo no histórico (comportamento já existente, apenas fica visível na tela);
- ao ativar o texto, o ciclo passa a fechar sozinho, sem nenhuma outra alteração.

## Detalhes técnicos

- Migração de dados: reatribuição do conteúdo importado (`import_version = 1`) para as chaves técnicas, com `title` recebendo o rótulo do Word; linhas antigas ficam `active = false`.
- `relationship_e20_occurrences`: novo `close_reason = 'oportunidade'`; `closure.server.ts` ignora ocorrências fechadas e `listClosureDuties` deixa de emitir obrigações para elas.
- Gatilho de cancelamento no ponto único de mudança de etapa (`set_lead_operational` / caminho de estágio do CRM) + reconciliação no `runClosureTick`.
- Painel da Biblioteca (`message-library-panel.tsx`): estado "sem texto oficial" para E20, E27 e FINALIZACAO, permitindo salvar rótulo mesmo sem versão ativa.
- Sem mudanças no Portal dos Leads, na integração GreenSales, no backup ou nas rotas.

## Fora deste escopo

- Cadastro do template Meta e preenchimento do WhatsApp dos executivos (dados operacionais, feitos por você nas telas existentes).
- Envio manual do CRM com textos fixos e telefone institucional nos perfis-semente — refino separado.
