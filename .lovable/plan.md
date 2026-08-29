# Rodada de correção total — Unidades, Apresentação Digital, E20/E27 e permissões

Correção única, baseada nas respostas desta bateria. Nada do motor que já funciona é refeito.

## 1. Carteira das unidades (Solar / Seguros)

- Registro completo do contato: autor (usuário e nome), data/hora, observação e motivo obrigatório ao encerrar.
- Histórico de todas as mudanças de situação e de atribuição, com autor e data/hora, exibido na ficha do interessado.
- Responsável por interessado: atribuir e trocar executivo, com registro de quem atribuiu.
- Filtros (responsável, situação, origem, faixa, unidade) e busca (nome, WhatsApp, e-mail).
- Contadores: total, novos, sem contato, em contato, encerrados.
- Deduplicação por WhatsApp normalizado e e-mail normalizado dentro da mesma unidade: novo envio atualiza o registro existente e guarda a repetição no histórico, em vez de criar outro card. Mesmo contato pode existir em Solar e Seguros de forma independente.
- Alteração restrita a permissão administrativa (admin e manager).

## 2. Páginas /s e /seg

- Somente identidade da unidade e formulário: remoção de qualquer texto de "conteúdo institucional em preparação" ou promessa de conteúdo futuro.
- Após o envio, apenas a confirmação — nenhum portal, gateway ou material é entregue na hora.
- Nenhum disparo automático nesta rodada: nada entra em portal_leads, CRM, cadência ou Gateway da Financeira. A origem "Veio do Grupo Velox" continua preservada.

## 3. Apresentação Digital

- Rascunho e publicação separados: editar cria rascunho; só o publicado entra em novas apresentações; rascunho nunca afeta emissões existentes.
- Preview idêntico à tela do investidor, com preview individual de cada vídeo.
- Metadados visíveis: número da versão, data da publicação e autor.
- Confirmação antes de publicar e antes de desativar capítulo; reativação permitida; nenhuma exclusão física; versão publicada é imutável (alterar gera nova versão).
- Lista com numeração, thumbnail e reordenação por arrastar e soltar; validação da URL do vídeo (hospedagem externa permitida).
- Cada apresentação emitida passa a exibir qual versão do roteiro utilizou.

## 4. Permissões e RLS

- Menu inteiro passa a respeitar autorização real (user_roles), sem depender do cargo operacional.
- Apresentação Digital: exclusiva de administrador (executivo e manager sem acesso).
- `presentation_chapters`: leitura e escrita restritas a permissão administrativa; sem exclusão.
- `relationship_e20_events`: executivo lê apenas eventos dos leads sob sua responsabilidade; admin e manager leem tudo.
- Formulário público das unidades ganha limite de envio por origem para evitar flood.

## 5. E20 — interação e estados

- Botão para abrir a apresentação vigente, botão separado para emitir nova (com confirmação explicando que a anterior é invalidada).
- Exibição da validade, da data de expiração e da quantidade de acessos, além do que já existe (primeiro acesso, último acesso, "Investidor visualizou", histórico, motivo e autor do encerramento).
- Novo botão "Marcar como enviada", com confirmação, autor e data/hora. Copiar continua sendo apenas copiar: nunca infere envio, e envio nunca infere visualização.
- Eventos separados na jornada: gerada, mensagem copiada, link copiado, enviada, aberta, expirada, encerrada (com motivo, autor e data/hora).

## 6. E27

- Abrir a apresentação cancela o checkpoint E27: o objetivo do checkpoint foi cumprido e o executivo assume a condução. O acesso continua registrado normalmente.

## Detalhes técnicos

- Novas colunas/tabelas: histórico de contato e atribuição dos interessados das unidades; campos de rascunho/publicação e autor em `presentation_chapters`; marcação de envio confirmado na ocorrência E20.
- Migrações incluem GRANT e políticas por papel; as políticas `USING true` de `presentation_chapters` e `relationship_e20_events` são substituídas.
- Deduplicação aplicada no servidor (`unit-leads.functions.ts`) com WhatsApp em dígitos e e-mail em minúsculas.
- Cancelamento da E27 tratado em `redeemE20` + `closure.server.ts`, mantendo idempotência.

## Não será tocado

Motor de emissão E20 (reuso, 7 dias, snapshot, acessos, expiração, encerramento com motivo), versionamento já existente da Apresentação, isolamento Solar/Seguros x Financeira, redirects `/` → `/f` e rotas legadas, `authorization.server.ts` e o motor de Remarketing.
