# Auditoria técnica completa e somente leitura do ambiente Financeira `/f`

## Limites obrigatórios
- Nenhuma alteração em código, banco, dados, configurações, componentes, funções, migrations ou deploy.
- Nenhuma execução que avance motor, fila, cadência, relógio, sincronização ou estado operacional.
- `/s`, `/s/portal` e `/seg` serão apenas considerados no mapa de dependências compartilhadas; nada será alterado.
- Código, consultas somente leitura, testes existentes e configurações atuais serão as fontes de verdade.

## 1. Corporate Workspace, perfis e origens
- Rastrear a montagem de `/f`, componentes, hooks, autorização, perfis executivo/administrador/híbrido e matriz real de permissões.
- Mapear cards, contadores, filtros e fontes de GreenSales, Rede de Distribuição, Portal, TikTok, Meta, Solar/Seg, Engajamento e demais origens.
- Identificar como origem, estágio, atividade, compromisso, responsável e indicadores são calculados.

## 2. Os dois comportamentos visuais de “NOVO”
- Rastrear separadamente o lead ainda não visualizado e o lead com atividade real posterior à visualização.
- Confirmar campos, funções, componentes e nomes reais usados; não criar categorias conceituais inexistentes no código.
- Auditar o contador “Marcar todos como lidos”, abertura individual, baixa em lote e a divergência Carlos/Wallace/João.
- Consultar somente leitura os registros necessários para identificar o evento e marcador pendente do João.
- Verificar se há identificador inequívoco entre novidade de entrada e novidade por atividade.

## 3. Portal do Investidor e reconhecimento de identidade
- Mapear visitante, sessão, gateway, token/link personalizado, acesso sem link, identidade, lead e executivo responsável.
- Confirmar ordem real de reconhecimento por e-mail, telefone/WhatsApp, identificadores e tabelas/campos.
- Rastrear navegação, visualização, módulos, material, retornos, tempo ativo, sessões e consolidação de engajamento.
- Explicar recadastro/pedido de especialista e a relação real entre `viewed_at`, atividade e estado do card.

## 4. GreenSales → Portal dos Leads → Workspace → Ação do Dia
- Rastrear sincronização, criação/atualização, identidade, responsável, origem, estágio, histórico, reentrada e deduplicação.
- Identificar regras adicionais ao espelhamento e o tratamento de um lead existente que retorna pelo Portal.
- Preservar como intocáveis os dados reais e a integração GreenSales.

## 5. Ação do Dia: armazenamento, montagem e ciclo completo
- Rastrear o clique de abertura até server functions, consultas, reconciliação, claims e fila devolvida ao cliente.
- Mapear todos os tipos reais de ação, fontes, estados, prioridades, vínculo com lead, pulo, retomada, andamento, conclusão e resolução.
- Para cada botão “Concluído”, identificar função chamada, registros/campos alterados e efeitos colaterais.
- Explicar a latência de abertura e separar fila persistida, reconstrução ao vivo e criação/reconciliação de obrigações.
- Auditar “Próximo compromisso” e distinguir futuro, devido e vencido, incluindo todas as fontes de verdade.

## 6. Prioridade real
- Confirmar ordenação entre claim em andamento, continuidade do lead, agenda/reunião, compromissos vencidos/devidos/futuros, cadência, atrasos, alertas do Portal e demais ações.
- Mapear precedência por fonte, buckets, `scheduled_at`/`due_at`, janela de continuidade e proteção da posição 1.

## 7. Motor de cadência E0–E8
- Auditar, etapa por etapa, ações, prazos, transições, contextos, compensações, estados e funções decisórias.
- Verificar especificamente as regras informadas de E0, E1, E2, E3, E4, E5, E6, E7 e E8.
- Rastrear E0 manual nos três cenários de atendimento e localizar a autoridade exata de E0 → E1.
- Auditar interferência de Frios, Zero Contato, Agendamento, Vídeo Chamada e pausas/retomadas.
- Comparar descrição informada, implementação, comentários, documentação e testes; destacar divergências literalmente.

## 8. Relógios, calendário e homologação
- Mapear relógio real, relógio de homologação, persistência, estados, fator temporal e isolamento por escopo/rodada.
- Auditar dias úteis, finais de semana, horários, fechamento, deslocamentos e feriados/dias não úteis.
- Confirmar se o relógio apenas fornece tempo ou também contém decisões de cadência.

## 9. Biblioteca de Conteúdos e Central de Nomes
- Mapear armazenamento, finalidades/etapas, contextos, versões, publicação, seleção `COM_NOME`/`SEM_NOME` e consumo pela cadência/Ação do Dia.
- Confirmar a validação real de nomes e o fluxo da Central de Nomes.
- Verificar se `body` é a fonte única vigente e localizar dependências reais ou legadas de `content_url`, `content_label`, links separados e `{{conteudo_e1}}`.
- Rastrear a busca da versão publicada até modal, copiar e conclusão.

## 10. Congelamento ao arrastar na Biblioteca
- Rastrear componente, `draggable`, eventos de drag/pointer/mouse, estado local/global, reordenação e persistência.
- Procurar exceções, sobreposição invisível, captura de eventos, estado de arraste não encerrado e falhas assíncronas.
- Classificar a causa como frontend, persistência, interação ou não confirmada, sem corrigir.

## 11. Central de Captação
- Rastrear Financeira, Solar e Seguradora de formulário a persistência, origem, destino, Portal dos Leads e Workspace.
- Identificar exatamente onde cada fluxo funciona, é incompleto, falha comprovadamente ou não pode ser confirmado.

## 12. Demais centrais e módulos do Portal
- Auditar Operações, Reuniões, Alertas, Backup, Homologação, Nomes, configurações, permissões e módulos.
- Auditar Manual, Material, Simulador, Nossa Estrutura, Revista e Princípios, incluindo liga/desliga individual, navegador, editor, imagens, persistência e autorização server-side.
- Classificar cada área sem transformar ausência de evidência em problema.

## 13. Atividade do Portal → alerta operacional
- Rastrear evento bruto, agregado de engajamento, novidade do Workspace, regra de sete dias e alerta já consumido pela Ação do Dia.
- Verificar se a conclusão do alerta resolve apenas o aviso ou também a novidade/evento original.
- Confirmar se a arquitetura atual suporta futuramente manter o NOVO até “Concluído” e então baixar somente a atividade original, sem lead, cadência, ligação, mensagem, origem ou motor paralelos.
- Distinguir claramente conexões já existentes das ausentes.

## 14. Mapa de arquitetura e dependências
Documentar ponta a ponta:
```text
GreenSales → Portal dos Leads → Workspace → Cadência → Ação do Dia
Portal do Investidor → Atividade → Engajamento → NOVO → Workspace → Alerta → Concluído → Baixa
Biblioteca → Versão publicada → Ação do Dia → Modal → Copiar → Concluído
```
Para cada seta: função, arquivo, server function, tabela/campo, estado e confirmação de existência.

## Método de validação
- Busca e leitura integral dos arquivos envolvidos.
- Consultas SQL exclusivamente `SELECT` para schema, registros necessários, políticas e relações.
- Leitura de logs disponíveis e testes existentes, sem disparar operações produtivas.
- Comparação entre código, banco, configuração, comentários e testes.
- Toda afirmação será marcada como comprovada, provável ou não confirmada.

## Relatório final
Usar as classificações:
- 🟢 **FUNCIONANDO** — comprovado.
- 🟡 **INCOMPLETO** — estrutura existente com comportamento faltante.
- 🔴 **PROBLEMA COMPROVADO** — comportamento incorreto/quebrado demonstrado.
- ⚪ **NÃO CONFIRMADO** — evidência insuficiente.

Entregar obrigatoriamente:
1. Mapa geral da arquitetura atual.
2. Tudo que funciona e não deve ser mexido.
3. Problemas comprovados.
4. Pontos incompletos.
5. Pontos não confirmados.
6. Dependências entre problemas.
7. Arquivos, funções, hooks, componentes, server functions, tabelas, campos e estados exatos.
8. Correções futuras recomendadas, sem implementá-las.
9. Top 5 por impacto operacional e dependências.
10. Riscos de alterar cada área.

Cada divergência relevante será apresentada como **DESCRIÇÃO INFORMADA** versus **IMPLEMENTAÇÃO ENCONTRADA**. Nenhuma preferência técnica será tratada como necessidade de refatoração.
