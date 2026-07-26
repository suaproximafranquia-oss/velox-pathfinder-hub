
# Sprint 02.5 + 02.6 + 02.8 — Plano de Execução (v2)

Escopo grande. Implementação em 3 blocos, preservando toda a arquitetura já construída. Nada será removido; apenas evoluído.

---

## BLOCO A — Sprint 02.5 (Estrutura e regras operacionais)

**A1. Validação dos usuários (obrigatório)**
- Auditar `src/lib/executive-auth.ts`: garantir autenticação, perfil, role e senha funcionando para todos os seeds (Thiago, Larissa, Marton, Paulo, Milton, Carlos, Talita).
- Smoke test via preview antes de fechar a sprint.

**A2. Proprietário do Investidor**
- Adicionar `ownerUserId` ao modelo de Investidor.
- Exibir "Executivo Responsável" em cadastro, lista, detalhes e relatórios.
- Filtro por role: Admin=todos · Gestor=equipe · Executivo=próprios.

**A3. Dados reais do executivo (fonte única)**
- Ampliar `ExecutiveUser` com nome, e-mail, telefone, cargo, data de admissão, gestorId.
- Refatorar consumidores (perfil, contatos, WhatsApp, manual personalizado) para ler do cadastro. Zero duplicação.

**A4. Data de admissão + Recognition**
- Campo `admissionDate` no perfil.
- Novos tipos: `first_month`, `company_anniversary`, `tenure_milestone`.
- Cálculo automático em `evaluateForLogin`.

**A5. Laboratório Atlas** (nova rota `/executivo/laboratorio`, só Admin)
- Botões: Simular Aniversário · KPI Pendente · Conquista de Campanha · Aniversário de Empresa.
- Evento aplicado apenas no próximo login; auto-remoção após exibição.

**A6. Recognition — tom humanizado**
- Reescrever templates: sem comparações, sem pressão, sem culpa, sem foco em lucro.
- Arrays de variações → nunca repete texto exato.

**A7. Aniversário de Empresa — tela comemorativa**
- Rota dedicada de celebração (full-screen) em vez do modal padrão.
- Consome apenas dados reais existentes; omite seções vazias; nunca inventa.

---

## BLOCO B — Sprint 02.6 (Fluxo Manual do Investidor)

**B0. Parâmetro "Executivo Padrão" da plataforma** *(novo)*
- Criar setting persistido `atlas:settings:defaultExecutiveId` (localStorage) lido por um único helper `getDefaultExecutive()`.
- Fallback temporário para demonstração: o **primeiro usuário com role Administrador** (não fixar Thiago). Sem código hard-coded por nome.
- Preparado para uma futura tela "Configurações da Plataforma" alterar o valor sem mudar código.

**B1. Dois modos de acesso**
- `/` = Modo Público. CTA final: "Quero conversar com um especialista da Velox." → cria Investidor atribuído ao **Executivo Padrão** (via B0).
- `/manual/$executiveSlug` = Modo Personalizado. CTA: "Quero voltar a falar com meu especialista." Investidor atribuído ao executivo do slug.

**B2. Botão final → WhatsApp dinâmico**
- Telefone lido do cadastro do executivo proprietário. Nunca número fixo.
- Mensagem: "Olá! Concluí o Manual do Investidor e gostaria de continuar nossa conversa. Tenho algumas dúvidas."

**B3. Dados do executivo em links personalizados**
- Header/rodapé do manual personalizado exibe nome, cargo, telefone, e-mail lidos do cadastro.

**B4. Relatório sob demanda**
- Ao concluir manual: salvar respostas no registro do Investidor. Sem PDF automático. Sem WhatsApp com PDF.
- Botão "Gerar Relatório" no detalhe do investidor usa `investor-report.ts`.

**B5. Propriedade permanente**
- `ownerUserId` do Investidor criado via link personalizado é imutável.

---

## BLOCO C — Sprint 02.8 (UX do KPI Manager)

**C1. Janela interna com altura fixa**
- Shell do KPI com `calc(100vh - offset)`; página principal não rola por causa do KPI. Rolagem H+V confinada.

**C2. Scrollbar de alto contraste**
- CSS `.kpi-scroll`: thumb claro/dourado, largura ~12px, hover reforçado, aparência elegante.

**C3. Cor da coluna "Total Vendido" por campanha**
- Helper `campaignTierFromValue(total)`:
  - < R$55k → padrão
  - Mestre (R$55k–69.999) → azul, texto branco
  - Doutor (R$70k–89.999) → identidade Doutor existente
  - PhD (R$90k–99.999) → preto, texto branco
  - Supreme (≥R$100k) → identidade Supreme existente

**C4. Reatividade automática**
- Classe derivada do valor; atualiza sem estado extra.

---

## Ordem de execução

1. Bloco A (fundação: usuários, ownership, admissão, executivo padrão).
2. Bloco B (Manual dois modos, WhatsApp dinâmico, relatório sob demanda).
3. Bloco C (UX KPI).

Aprovar para iniciar?
