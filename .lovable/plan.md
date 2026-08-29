# Registro de Decisões — Portal Raiz do Grupo, Apresentação Digital e Ação do Dia

Escopo desta entrega: **somente registrar as decisões** como regras permanentes do projeto.
Nenhum código, banco, migration, dado ou tela será alterado agora. As regras abaixo passam a
ser premissa obrigatória das próximas implementações.

## Bloco A — Portal raiz do Grupo Velox

- O domínio raiz (`/`, sem `/f`, `/s` ou `/seg`) abre **exclusivamente o ambiente institucional
  do Grupo Velox**: público, sem login, sem Gateway e sem captação operacional.
- A raiz apresenta as três empresas — **Velox Soluções Financeiras**, **Velox Solar** e
  **Velox Seguros** — e cada botão leva ao respectivo ambiente público: `/f`, `/s`, `/seg`.
- **O portal do investidor da Financeira, hoje na raiz, passa a viver em `/f`.**
  `/f/{executivo}` continua idêntico como link personalizado: muda apenas o destino do
  redirecionamento (deixa de ser `/` e passa a ser `/f`).
- Os três ambientes compartilham a mesma arquitetura visual/estrutural, mas cada um tem
  **conteúdo próprio e dados próprios**. A raiz tem identidade visual própria do Grupo,
  distinta da identidade operacional da Financeira.
- A raiz é o "cérebro institucional": apresenta o ecossistema e direciona. Não concentra
  informação comercial das três empresas nem simulador, formulário de lead ou cadência.
- "Seja um Franqueado" na raiz **não capta na raiz**: ele leva o visitante a escolher a unidade
  e a captação acontece dentro dela.
- Conteúdo institucional do Grupo: **estático nesta primeira versão**, com estrutura preparada
  para se tornar administrável depois.
- Administração desse conteúdo: **exclusiva do administrador**. Executivos comuns não têm
  acesso administrativo à raiz. O perfil híbrido do Thiago enxerga a área **por ser
  administrador**, nunca por ser executivo — quem libera a tela é a **permissão
  administrativa**, não o cargo operacional.
- Estar logado **não** redireciona ninguém: acessar a raiz mostra o portal institucional
  normalmente; o ambiente operacional só começa em `/f`.
- `/s` e `/seg` funcionarão da mesma forma, com dados isolados. **Solar e Seguros jamais
  entram no `portal_leads` da Financeira.** O Grupo pode ter captação própria no futuro,
  separada da captação da Financeira.
- **Identificador de origem:** o visitante que chega pelo Grupo carrega origem própria; ao
  clicar em Financeira, Solar ou Seguros, o destino registra que ele **veio do Grupo**.
  Isso se soma ao contexto de entrada já existente (executivo, marca, campanha, canal) e não
  substitui nenhuma origem atual.

## Bloco B — Apresentação Digital (E20 / rótulo "E6 — Apresentação Digital")

**Acesso**

- Área **pública, sem login**, acessível apenas pelo convite. O investidor recebe somente o
  link temporário individual e **nunca alcança o Workspace** a partir dele.
- O endereço da apresentação é permanente; o que expira é o **token**, individual por
  emissão/ocorrência, com **7 dias corridos**. Expirado, a tela informa que o acesso expirou —
  sem conteúdo e sem novo link automático.
- O investidor pode reabrir o mesmo convite quantas vezes quiser dentro dos 7 dias. **Cada
  abertura é registrada.**

**Visibilidade no Workspace**

- O Workspace mostra: quantidade de aberturas, data/hora do **primeiro** acesso, data/hora da
  **última** abertura, e o **histórico completo de apresentações** daquele lead.
- Havendo E20 vigente, o botão exibe **"Apresentação ativa — abrir/visualizar"**, não gera
  outra. Clique repetido **reutiliza o mesmo convite**. Uma nova emissão explícita **encerra a
  anterior** e abre nova instância de cadência, como já definido.

**Geração**

- O botão "Gerar Apresentação Digital" existe **somente no Workspace do executivo**, dentro do
  card/ficha individual do lead.
- Só aparece quando o lead está em condição válida para E20. **Bloqueado/oculto em OPORTUNIDADE
  e com o ciclo encerrado.**
- Ao gerar: primeiro cria-se a **ocorrência E20**, depois o link, e no mesmo momento monta-se a
  **mensagem oficial da Biblioteca**, já com o **primeiro nome do investidor** e o **link
  inserido automaticamente**.
- Existem dois botões: **"Copiar mensagem"** e **"Copiar link"**. **Copiar é apenas copiar** —
  nunca marca como enviado.
- O envio continua sendo **responsabilidade do executivo** (WhatsApp manual). O sistema registra
  que a apresentação foi **gerada**; **jamais presume envio**.
- O executivo **pode encerrar manualmente** uma E20 vigente, com **motivo obrigatório**,
  registrado na Jornada com autor e horário. Nova emissão, OPORTUNIDADE e encerramento de ciclo
  continuam encerrando automaticamente.

**Relação com a E27**

- A **E27 só nasce depois de a E20 ter sido efetivamente gerada.** Sem E20, não existe E27.
- Gerada a E20, a E27 entra automaticamente no motor e, no dia devido, na Ação do Dia.
- Resposta do investidor antes da E27 segue as regras normais do motor (inbound, presença,
  encerramento por OPORTUNIDADE).

**Conteúdo e administração dos vídeos**

- A Apresentação Digital **terá vídeos**, cadastrados e editados em uma tela **administrativa**.
- Essa tela é liberada por **permissão administrativa**, não por cargo. Executivos comuns não a
  enxergam; o administrador (inclusive no perfil híbrido) enxerga. O investidor vê **somente a
  apresentação pronta**, nunca a biblioteca/gestão.
- A tela permite **vários vídeos**, cada um correspondendo a uma parte/capítulo, com **ordem
  configurável**, **título**, **descrição**, **vídeo** e **ativar/desativar**. Vídeo desativado
  não aparece ao investidor.
- **Histórico preservado:** nada é apagado; alterações versionam, não sobrescrevem.
- **Congelamento na emissão (decisão confirmada):** a emissão da E20 grava um **snapshot do
  roteiro** — vídeos, ordem, títulos e descrições vigentes naquele instante — exatamente como
  já fazemos com os destinos da E0. Uma E20 emitida hoje continua mostrando o conteúdo daquele
  momento mesmo que a apresentação mude amanhã. **Somente novas emissões usam o conteúdo novo.**

## Bloco C — Ação do Dia, Jornada e histórico

- A Ação do Dia **orienta e leva**: informa que existe uma apresentação a gerar **e** oferece o
  atalho direto para o lead no Workspace. O **botão de gerar continua exclusivo do Workspace**.
- Gerada a E20, a Ação do Dia deixa de cobrar a geração e passa a mostrar apenas as próximas
  obrigações do ciclo.
- A **E20 manual aparece na Jornada** como evento do ciclo — não é evento paralelo.
- O histórico distingue estados independentes: **E20 gerada**, **mensagem copiada**,
  **mensagem enviada**, **apresentação aberta**, **apresentação expirada**, **E20 encerrada**
  (com motivo e autor).
- Em todos os relatórios, **gerada ≠ enviada ≠ visualizada**. Nenhum desses estados infere o
  outro.
- A abertura da apresentação pelo investidor **gera atividade real no Portal** e **alimenta a
  lógica de presença de 15 minutos** já definida.
- A abertura fica visível ao executivo com um indicador **"Investidor visualizou"** no
  Workspace, junto do contador e das datas de primeiro/último acesso.
- **Não existe conceito de conclusão da apresentação.** Registramos acessos e progresso; o
  sistema nunca declara que o investidor "terminou".

## Escopo intocável reafirmado

Portal dos Leads, integração GreenSales, snapshots e histórico, identidade atômica do lead,
OPORTUNIDADE como estágio terminal, Biblioteca oficial e a regra de que a **Gestão de Usuários
é a única fonte do WhatsApp do executivo** permanecem inalterados.

## Próximo passo

Nenhuma implementação nesta etapa. Quando você pedir, a ordem sugerida é:
**Bloco A** (raiz do Grupo + Financeira em `/f`) → **Bloco B** (convite, gestão de vídeos,
snapshot do roteiro) → **Bloco C** (Ação do Dia, Jornada e indicadores).
