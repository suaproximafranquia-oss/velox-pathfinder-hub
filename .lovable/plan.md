# Desenho Final — Portal Raiz, Apresentação Digital (E6/E20) e Ciclo E27

Confirmação das 77 perguntas, consolidada como especificação. Nada implementado nesta etapa.

## 1. Portal e URLs (1–10)

- `/` = Grupo Velox institucional, público, sem login, sem Gateway, sem captação. **Sim**
- `/f` = Velox Financeira (Portal do Investidor atual, movido da raiz). **Sim**
- `/s` = Velox Solar, `/seg` = Velox Seguros — hoje só existem como marcas em
  `src/lib/portal-brands.ts`; passam a ter rota institucional própria. **Sim**
- `/f/{slug}` continua funcionando exatamente como hoje (executivo, contexto `e`, `m`, `o`, `b`).
  Muda apenas o destino do redirecionamento: `/` → `/f`, preservando todos os parâmetros.
- Links antigos para `/` continuam funcionando: `/` com parâmetros de contexto
  (`lead`, `e`, `m`, `o`, `b`) redireciona para `/f` mantendo os mesmos parâmetros.
  A raiz limpa passa a ser institucional.
- Raiz tem botão "Seja um Franqueado" que leva à escolha da empresa (Financeira, Solar, Seguros).
- Origem "veio do Grupo" é registrada no `EntryContext` existente (`src/lib/portal-entry.ts`),
  como origem institucional — sem mecanismo novo.
- Solar e Seguros ficam **completamente fora** de `portal_leads`, CRM e cadência da Financeira.
- **Agora:** Solar e Seguros ficam **institucionais, sem captação operacional**. Só conteúdo e
  contato direto. A captação exige antes uma chave de unidade e isolamento por RLS — fica para
  um comando futuro.

## 2. Área administrativa da Apresentação (11–25)

- Nome da área: **"Apresentação Digital"**.
- Visível na lateral **somente para administrador** — permissão administrativa independente do
  cargo, nascida no mesmo modelo (`src/config/modules.ts` + `workspace_module_permissions`).
  Você enxerga por ser administrador; executivos comuns não enxergam.
- Cadastro de vídeo: título, descrição, URL/arquivo, ordem, ativo/inativo, capa/thumbnail.
- Vários capítulos permitidos (roteiro ordenado).
- Pré-visualização do roteiro exatamente como o investidor verá, antes de publicar.
- Alteração cria **nova versão**; nada é apagado fisicamente.
- **E20 já emitida permanece congelada** pelo snapshot do roteiro: alterar ou desativar vídeo
  não muda apresentação já enviada.

## 3. E20 — geração (26–41)

- Botão **somente no Workspace, dentro do lead**. Não no CRM. Não na Ação do Dia.
- Gerar cria o convite de 7 dias, monta a mensagem da Biblioteca, insere primeiro nome e link,
  e **mostra a mensagem na tela**.
- Dois botões: **Copiar mensagem** e **Copiar link**.
- Copiar **não** significa enviar. O sistema nunca presume envio manual de WhatsApp.
- Estados registrados separadamente: **gerada · copiada · enviada · aberta**.
- Com E20 ativa, clique não gera outra: a tela mostra "Apresentação ativa".
- Nova emissão exige comando explícito **com confirmação**, porque invalida a anterior.

## 4. E27 e cadência (42–47)

- E20 gerada ⇒ E27 criada, mesmo sem envio.
- E27 entra automaticamente no motor e aparece na Ação do Dia na hora certa.
- Visualização da E20 **não** cancela E27.
- Resposta do investidor segue o motor normal.
- OPORTUNIDADE cancela E27 e Finalização.

## 5. Link público (48–56)

- Acesso sem login, token de exatamente 7 dias corridos, aberturas ilimitadas no período.
- Cada abertura registrada (`relationship_e20_accesses`).
- Expirado: sem conteúdo e **sem** gerar outro automaticamente.
- O investidor jamais vê Workspace, biblioteca ou administração; não há botão de login.

## 6. Indicadores (57–63)

- Workspace mostra: nº de aberturas, primeiro acesso, **último acesso**, histórico completo de
  E20 e o indicador "Investidor visualizou".
- Gerada ≠ enviada ≠ visualizada. **Não existe** "apresentação concluída".

## 7. Encerramento (64–71)

- Executivo pode encerrar manualmente, com **motivo obrigatório**, autor e data/hora.
- Encerramento vai para a Jornada.
- Encerram também: nova E20, OPORTUNIDADE e fim do ciclo.

## 8. Ação do Dia (72–76)

- Antes da E20, sinaliza que existe apresentação a gerar e leva direto ao lead.
- **Sem** botão de geração.
- Depois de gerada, a obrigação some; permanecem apenas E27 e Finalização.

## 9. A pergunta 77

**Sim, exatamente.** Gerar + copiar sem enviar = E20 "gerada", nunca "enviada".
A E27 segue normalmente, porque ela nasce da emissão, não do envio. O sistema nunca
inventa um envio que o executivo não confirmou.

## Comandos de implementação (execução em três fases)

1. **Raiz do Grupo + `/f`** — nova raiz institucional, Portal da Financeira em `/f`,
   `/s` e `/seg` institucionais, redirecionamentos preservando contexto, origem "veio do Grupo".
2. **Apresentação Digital** — permissão administrativa, cadastro versionado de vídeos,
   snapshot do roteiro na emissão, área pública do convite exibindo o roteiro congelado.
3. **Ciclo e indicadores** — copiar mensagem, estados gerada/copiada/enviada/aberta,
   último acesso e trilha de aberturas, encerramento manual com motivo, eventos na Jornada.

## Dependências de conteúdo

- Texto oficial da E20 e da E27 na Biblioteca.
- Vídeos e roteiro da Apresentação Digital.
- Conteúdo institucional do Grupo, Solar e Seguros.
