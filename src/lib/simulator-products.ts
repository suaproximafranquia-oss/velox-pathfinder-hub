/**
 * Parâmetros internos do Simulador Inteligente de Potencial de Receita.
 * As comissões médias abaixo são de uso EXCLUSIVAMENTE INTERNO — nunca
 * exibidas cruamente ao investidor sem o disclaimer obrigatório.
 *
 * `avgTicket` é o valor médio de referência utilizado apenas para
 * estimativa ilustrativa da receita por operação; representa uma média
 * de mercado adotada como convenção da simulação.
 */
export type ProductCategory =
  | "Consignado"
  | "Crédito"
  | "Financiamento"
  | "Consórcios"
  | "Sustentável"
  | "Seguros e Benefícios"
  | "Empresarial"
  | "Rural"
  | "Investimentos";

export type SimulatorProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  /** Comissão média (%) usada no cálculo interno. */
  commission: number;
  /** Rótulo apresentado no relatório (ex.: "até 5%", "1% a 4%"). */
  commissionLabel: string;
  /** Ticket médio (R$) de referência para uma operação. */
  avgTicket: number;
  /** Comissão recorrente mensal (percentual sobre volume mantido). */
  recurring?: boolean;
  /**
   * Modelo de precificação usado na Etapa 2 do simulador.
   * - "volume": usuário informa o VOLUME FINANCEIRO mensal (R$) da produção.
   * - "quantity": usuário informa a QUANTIDADE de contratos/operações mensais
   *   (para produtos recorrentes: seguros, benefícios, POS).
   */
  pricingModel: "volume" | "quantity";
};

export const SIMULATOR_PRODUCTS: SimulatorProduct[] = [
  { id: "fgts", name: "FGTS", category: "Consignado", commission: 25, commissionLabel: "até 25%", avgTicket: 2200, pricingModel: "volume" },
  { id: "inss-port", name: "INSS Portabilidade", category: "Consignado", commission: 4, commissionLabel: "até 4%", avgTicket: 18000, pricingModel: "volume" },
  { id: "inss-margem", name: "INSS Margem Livre", category: "Consignado", commission: 10, commissionLabel: "até 10%", avgTicket: 12000, pricingModel: "volume" },
  { id: "loas", name: "LOAS", category: "Consignado", commission: 9, commissionLabel: "até 9%", avgTicket: 8000, pricingModel: "volume" },
  { id: "amparo", name: "Amparo Social", category: "Consignado", commission: 9, commissionLabel: "até 9%", avgTicket: 8000, pricingModel: "volume" },
  { id: "exercito", name: "Exército", category: "Consignado", commission: 4, commissionLabel: "até 4%", avgTicket: 22000, pricingModel: "volume" },
  { id: "aeronautica", name: "Aeronáutica", category: "Consignado", commission: 7, commissionLabel: "até 7%", avgTicket: 22000, pricingModel: "volume" },
  { id: "siape", name: "Federal / SIAPE", category: "Consignado", commission: 7, commissionLabel: "até 7%", avgTicket: 30000, pricingModel: "volume" },
  { id: "estadual", name: "Funcionário Estadual", category: "Consignado", commission: 10, commissionLabel: "até 10%", avgTicket: 20000, pricingModel: "volume" },
  { id: "velox-clt", name: "Velox CLT", category: "Consignado", commission: 7, commissionLabel: "até 7%", avgTicket: 8000, pricingModel: "volume" },
  { id: "cartao-emp", name: "Empréstimo no Cartão", category: "Crédito", commission: 40, commissionLabel: "até 40%", avgTicket: 3000, pricingModel: "volume" },
  { id: "conta-luz", name: "Empréstimo Conta de Luz", category: "Crédito", commission: 10, commissionLabel: "até 10%", avgTicket: 1500, pricingModel: "volume" },
  { id: "refin", name: "Refinanciamento", category: "Crédito", commission: 7, commissionLabel: "até 7%", avgTicket: 15000, pricingModel: "volume" },
  { id: "home-equity", name: "Home Equity", category: "Crédito", commission: 5, commissionLabel: "até 5%", avgTicket: 250000, pricingModel: "volume" },
  { id: "fin-imob", name: "Financiamento Imobiliário", category: "Financiamento", commission: 2.2, commissionLabel: "até 2,2%", avgTicket: 400000, pricingModel: "volume" },
  { id: "fin-veic", name: "Financiamento de Veículos", category: "Financiamento", commission: 2.5, commissionLabel: "até 2,5%", avgTicket: 60000, pricingModel: "volume" },
  { id: "refin-veic", name: "Refinanciamento de Veículos", category: "Financiamento", commission: 2.5, commissionLabel: "até 2,5%", avgTicket: 45000, pricingModel: "volume" },
  { id: "consorcios", name: "Consórcios", category: "Consórcios", commission: 5, commissionLabel: "média 5% (até 6%)", avgTicket: 80000, pricingModel: "volume" },
  { id: "solar", name: "Energia Solar", category: "Sustentável", commission: 8, commissionLabel: "até 8%", avgTicket: 35000, pricingModel: "volume" },
  { id: "usinas", name: "Usinas de Investimento", category: "Sustentável", commission: 8, commissionLabel: "até 8%", avgTicket: 250000, pricingModel: "volume" },
  { id: "carbono", name: "Crédito de Carbono", category: "Sustentável", commission: 8, commissionLabel: "até 8%", avgTicket: 50000, pricingModel: "volume" },
  { id: "motos-el", name: "Motos Elétricas", category: "Sustentável", commission: 8, commissionLabel: "até 8%", avgTicket: 18000, pricingModel: "volume" },
  { id: "seguros", name: "Seguros", category: "Seguros e Benefícios", commission: 80, commissionLabel: "até 80%", avgTicket: 2400, pricingModel: "quantity" },
  { id: "cartao-benef", name: "Cartão de Benefícios", category: "Seguros e Benefícios", commission: 0.75, commissionLabel: "0,30% a 1,20% recorrente", avgTicket: 3000, recurring: true, pricingModel: "quantity" },
  { id: "antec-receb", name: "Antecipação de Recebíveis", category: "Empresarial", commission: 1, commissionLabel: "até 1%", avgTicket: 80000, pricingModel: "volume" },
  { id: "capital-giro", name: "Capital de Giro", category: "Empresarial", commission: 1, commissionLabel: "até 1%", avgTicket: 150000, pricingModel: "volume" },
  { id: "desc-cheques", name: "Desconto de Cheques", category: "Empresarial", commission: 1, commissionLabel: "até 1%", avgTicket: 40000, pricingModel: "volume" },
  { id: "antec-contratos", name: "Antecipação de Contratos", category: "Empresarial", commission: 1, commissionLabel: "até 1%", avgTicket: 120000, pricingModel: "volume" },
  { id: "fin-fornec", name: "Financiamento de Fornecedores", category: "Empresarial", commission: 1, commissionLabel: "até 1%", avgTicket: 100000, pricingModel: "volume" },
  { id: "ccb", name: "Operação CCB", category: "Empresarial", commission: 1, commissionLabel: "até 1%", avgTicket: 250000, pricingModel: "volume" },
  { id: "trust", name: "Serviços Trust", category: "Empresarial", commission: 1, commissionLabel: "até 1%", avgTicket: 200000, pricingModel: "volume" },
  { id: "pos", name: "POS", category: "Empresarial", commission: 0.30, commissionLabel: "0,10% a 0,50% recorrente", avgTicket: 40000, recurring: true, pricingModel: "quantity" },
  { id: "rural", name: "Crédito Rural", category: "Rural", commission: 1, commissionLabel: "até 1%", avgTicket: 200000, pricingModel: "volume" },
  { id: "maquinario", name: "Compra de Maquinário", category: "Rural", commission: 1, commissionLabel: "até 1%", avgTicket: 300000, pricingModel: "volume" },
  { id: "propriedades", name: "Compra de Propriedades", category: "Rural", commission: 1, commissionLabel: "até 1%", avgTicket: 500000, pricingModel: "volume" },
  { id: "garantia-rural", name: "Garantia Rural", category: "Rural", commission: 1, commissionLabel: "até 1%", avgTicket: 150000, pricingModel: "volume" },
  { id: "asset", name: "Velox Asset", category: "Investimentos", commission: 2.5, commissionLabel: "1% a 4%", avgTicket: 150000, pricingModel: "volume" },
  { id: "precatorios", name: "Velox Precatórios", category: "Investimentos", commission: 3, commissionLabel: "1% a 5%", avgTicket: 200000, pricingModel: "volume" },
];

export function getProduct(id: string) {
  return SIMULATOR_PRODUCTS.find((p) => p.id === id);
}

export function estimateMonthlyRevenue(product: SimulatorProduct, quantity: number): number {
  if (!quantity || quantity <= 0) return 0;
  return product.avgTicket * (product.commission / 100) * quantity;
}

/**
 * Receita mensal estimada a partir do VOLUME financeiro informado (R$).
 * Usado para produtos cuja remuneração depende do valor da operação.
 */
export function estimateFromVolume(product: SimulatorProduct, volume: number): number {
  if (!volume || volume <= 0) return 0;
  return volume * (product.commission / 100);
}

/**
 * Cálculo unificado: aceita `input` como volume (R$) para produtos "volume"
 * ou como quantidade de contratos para produtos "quantity".
 * Retorna também o volume mensal implícito para exibição no relatório.
 */
export function estimateRevenue(
  product: SimulatorProduct,
  input: number,
): { revenue: number; volume: number } {
  const v = Math.max(0, input || 0);
  if (product.pricingModel === "volume") {
    return { revenue: estimateFromVolume(product, v), volume: v };
  }
  const volume = product.avgTicket * v;
  return { revenue: estimateMonthlyRevenue(product, v), volume };
}

export function formatBRLInput(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function parseBRLInput(raw: string): number {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10);
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}