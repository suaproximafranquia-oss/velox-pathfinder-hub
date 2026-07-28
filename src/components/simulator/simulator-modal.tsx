import { useEffect, useMemo, useRef, useState } from "react";
import { X, ArrowRight, ArrowLeft, Check, Calculator, RotateCcw, MessageCircle, FileCheck2 } from "lucide-react";
import {
  SIMULATOR_PRODUCTS,
  estimateRevenue,
  formatBRL,
  parseBRLInput,
  formatBRLInput,
  type ProductCategory,
  type SimulatorProduct,
} from "@/lib/simulator-products";
import { emitEvent } from "@/lib/events/bus";
import { getCurrentInvestorId, getPortalSession } from "@/lib/portal-session";
import { getResponsibleExecutive } from "@/lib/responsible-executive";
import { generateSimulatorPdf } from "@/lib/simulator-report";
import { WHATSAPP_NUMBER } from "@/lib/journey-data";

type Step = 1 | 2 | 3;

const CATEGORY_ORDER: ProductCategory[] = [
  "Consignado",
  "Crédito",
  "Financiamento",
  "Consórcios",
  "Sustentável",
  "Seguros e Benefícios",
  "Empresarial",
  "Rural",
  "Investimentos",
];

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  Consignado: "#1E3A5F",
  Crédito: "#2C5282",
  Financiamento: "#3B7EA1",
  Consórcios: "#B08D57",
  Sustentável: "#4A7C59",
  "Seguros e Benefícios": "#8B5A3C",
  Empresarial: "#5C4A72",
  Rural: "#7A6135",
  Investimentos: "#1F4E5F",
};

export function SimulatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Para produtos "volume": valor em R$ mensal informado.
  // Para produtos "quantity": quantidade de contratos mensais.
  const [inputs, setInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const reset = () => {
    setStep(1);
    setSelected(new Set());
    setInputs({});
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedProducts = useMemo(
    () => SIMULATOR_PRODUCTS.filter((p) => selected.has(p.id)),
    [selected],
  );

  const grouped = useMemo(() => {
    const map = new Map<ProductCategory, SimulatorProduct[]>();
    for (const p of SIMULATOR_PRODUCTS) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, []);

  const results = useMemo(() => {
    const rows = selectedProducts.map((p) => {
      const input = Math.max(0, inputs[p.id] ?? 0);
      const { revenue, volume } = estimateRevenue(p, input);
      return { product: p, input, volume, revenue };
    });
    const total = rows.reduce((sum, r) => sum + r.revenue, 0);
    const byCategory = new Map<ProductCategory, number>();
    for (const r of rows) {
      byCategory.set(r.product.category, (byCategory.get(r.product.category) ?? 0) + r.revenue);
    }
    return { rows, total, byCategory };
  }, [selectedProducts, inputs]);

  const canAdvance = selected.size > 0;
  const canCalculate = selectedProducts.some((p) => (inputs[p.id] ?? 0) > 0);

  useEffect(() => {
    if (!open) return;
    const investorId = getCurrentInvestorId();
    emitEvent({
      type: "simulator.started",
      investorId,
    });
  }, [open]);

  // A conclusão emite o evento e gera o PDF UMA única vez por sessão de
  // simulação (evita reprocessar em re-renderizações do step 3).
  const completedRef = useRef(false);
  const [pdfInfo, setPdfInfo] = useState<{ filename: string } | null>(null);
  useEffect(() => {
    if (step !== 3) {
      completedRef.current = false;
      setPdfInfo(null);
      return;
    }
    if (completedRef.current) return;
    completedRef.current = true;
    const investorId = getCurrentInvestorId();
    const session = getPortalSession();
    let pdf: { filename: string } | null = null;
    try {
      pdf = generateSimulatorPdf({
        investorName: session?.name ?? "Investidor",
        rows: results.rows,
        total: results.total,
        byCategory: results.byCategory,
      });
    } catch {
      /* mantém confirmação mesmo se PDF falhar */
    }
    setPdfInfo(pdf);
    emitEvent({
      type: "simulator.completed",
      investorId,
      payload: {
        total: results.total,
        annual: results.total * 12,
        products: results.rows.map((r) => ({ id: r.product.id, volume: r.volume, revenue: r.revenue })),
        pdf: pdf?.filename ?? null,
      },
    });
  }, [step, results.total, results.rows, results.byCategory]);


  return (
    <div
      className={
        "fixed inset-0 z-[75] transition-opacity duration-400 " +
        (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
      }
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label="Simulador Inteligente de Potencial de Receita"
    >
      <button
        type="button"
        aria-label="Fechar simulador"
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: "color-mix(in oklab, var(--ink) 55%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      />
      <div
        className="absolute inset-x-[3vw] top-[3vh] bottom-[3vh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: "color-mix(in oklab, var(--paper) 25%, transparent)",
          background: "var(--paper)",
          boxShadow: "0 60px 120px -30px color-mix(in oklab, var(--ink) 70%, transparent)",
        }}
      >
        <SimulatorHeader step={step} onClose={onClose} />

        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <StepSelectProducts
              grouped={grouped}
              selected={selected}
              onToggle={toggle}
            />
          )}
          {step === 2 && (
            <StepQuantities
              products={selectedProducts}
              inputs={inputs}
              onChange={(id, v) => setInputs((s) => ({ ...s, [id]: v }))}
            />
          )}
          {step === 3 && (
            <StepConfirmation
              pdfFilename={pdfInfo?.filename ?? null}
              onRestart={reset}
              onClose={onClose}
            />
          )}
        </div>

        <SimulatorFooter
          step={step}
          selectedCount={selected.size}
          canAdvance={canAdvance}
          canCalculate={canCalculate}
          onBack={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          onNext={() => setStep(2)}
          onCalculate={() => setStep(3)}
          onRestart={reset}
          hidden={step === 3}
        />
      </div>
    </div>
  );
}

function SimulatorHeader({ step, onClose }: { step: Step; onClose: () => void }) {
  const labels = ["Produtos", "Expectativa", "Confirmação"];
  return (
    <div
      className="flex items-center justify-between gap-6 border-b px-6 py-5 md:px-10"
      style={{ borderColor: "var(--paper-edge)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "color-mix(in oklab, var(--brand-orange) 14%, transparent)", color: "var(--brand-orange)" }}
        >
          <Calculator className="h-4 w-4" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="portal-eyebrow">Simulador Velox</span>
          <span className="portal-serif text-lg md:text-xl">Potencial de Receita</span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3">
        {labels.map((label, i) => {
          const idx = (i + 1) as Step;
          const active = idx === step;
          const done = idx < step;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition"
                style={{
                  background: active || done ? "var(--brand-blue-deep)" : "transparent",
                  color: active || done ? "var(--paper)" : "var(--muted-foreground)",
                  border: `1px solid ${active || done ? "var(--brand-blue-deep)" : "var(--paper-edge)"}`,
                }}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: active ? "var(--brand-blue-deep)" : "var(--muted-foreground)" }}
              >
                {label}
              </span>
              {i < labels.length - 1 && (
                <span className="h-px w-8" style={{ background: "var(--paper-edge)" }} />
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition hover:scale-105"
        style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function StepSelectProducts({
  grouped,
  selected,
  onToggle,
}: {
  grouped: readonly (readonly [ProductCategory, SimulatorProduct[]])[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8 max-w-3xl">
        <span className="portal-eyebrow">Etapa 1 · Escolha dos produtos</span>
        <h2 className="portal-serif mt-3 text-3xl md:text-4xl" style={{ color: "var(--brand-blue-deep)" }}>
          Quais produtos fariam parte da sua operação?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          Selecione livremente quantos produtos quiser — organizamos por categoria para facilitar a leitura.
          Você pode combinar frentes complementares para simular cenários reais.
        </p>
      </div>

      <div className="space-y-8">
        {grouped.map(([category, products]) => (
          <section key={category}>
            <div className="mb-3 flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CATEGORY_COLORS[category] }}
              />
              <span className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--brand-blue-deep)]">
                {category}
              </span>
              <span className="h-px flex-1" style={{ background: "var(--paper-edge)" }} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {products.map((p) => {
                const on = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggle(p.id)}
                    aria-pressed={on}
                    className="group relative flex min-h-[64px] items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] leading-tight transition-all"
                    style={{
                      background: on ? "var(--brand-blue-deep)" : "var(--paper-2, #fff)",
                      borderColor: on ? "var(--brand-blue-deep)" : "var(--paper-edge)",
                      color: on ? "var(--paper)" : "var(--brand-blue-deep)",
                      boxShadow: on ? "0 8px 20px -14px color-mix(in oklab, var(--brand-blue-deep) 60%, transparent)" : "none",
                    }}
                  >
                    <span className="pr-1 font-medium">{p.name}</span>
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition"
                      style={{
                        borderColor: on ? "var(--brand-orange)" : "var(--paper-edge)",
                        background: on ? "var(--brand-orange)" : "transparent",
                        color: on ? "var(--paper)" : "transparent",
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function StepQuantities({
  products,
  inputs,
  onChange,
}: {
  products: SimulatorProduct[];
  inputs: Record<string, number>;
  onChange: (id: string, q: number) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8 max-w-3xl">
        <span className="portal-eyebrow">Etapa 2 · Expectativa de produção</span>
        <h2 className="portal-serif mt-3 text-3xl md:text-4xl" style={{ color: "var(--brand-blue-deep)" }}>
          Qual sua expectativa de produção mensal?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          Para operações financeiras, informe o <strong>valor mensal estimado</strong> em reais.
          Para produtos recorrentes (Seguros, Benefícios e POS), informe a <strong>quantidade de contratos</strong> por mês.
          Os botões + e − ajudam a ajustar rapidamente o valor informado.
        </p>
      </div>

      <div className="space-y-2">
        {products.map((p) => {
          const value = inputs[p.id] ?? 0;
          return (
            <ProductInputRow
              key={p.id}
              product={p}
              value={value}
              onChange={(v) => onChange(p.id, v)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProductInputRow({
  product,
  value,
  onChange,
}: {
  product: SimulatorProduct;
  value: number;
  onChange: (v: number) => void;
}) {
  const isVolume = product.pricingModel === "volume";
  // Passo dinâmico para volume: 10% do valor, arredondado para o milhar, mínimo R$ 1.000.
  const volumeStep = Math.max(1000, Math.round((value * 0.1) / 1000) * 1000 || 1000);
  const dec = () =>
    onChange(isVolume ? Math.max(0, value - volumeStep) : Math.max(0, value - 1));
  const inc = () => onChange(isVolume ? value + volumeStep : value + 1);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4"
      style={{ borderColor: "var(--paper-edge)", background: "var(--paper-2, #fff)" }}
    >
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[product.category] }} />
        <div>
          <div className="text-[15px] font-medium" style={{ color: "var(--brand-blue-deep)" }}>{product.name}</div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            {product.category} · {isVolume ? "Volume mensal (R$)" : "Contratos / mês"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          aria-label={`Diminuir ${product.name}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg transition hover:bg-black/5"
          style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
        >
          −
        </button>
        {isVolume ? (
          <input
            type="text"
            inputMode="numeric"
            value={value > 0 ? formatBRLInput(value) : ""}
            placeholder="R$ 0"
            onChange={(e) => onChange(parseBRLInput(e.target.value))}
            className="h-10 w-40 rounded-lg border px-3 text-right text-[15px] font-semibold outline-none focus:border-[color:var(--brand-orange)]"
            style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
          />
        ) : (
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
            className="h-10 w-24 rounded-lg border text-center text-[15px] font-semibold outline-none focus:border-[color:var(--brand-orange)]"
            style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
          />
        )}
        <button
          type="button"
          onClick={inc}
          aria-label={`Aumentar ${product.name}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg transition hover:bg-black/5"
          style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
        >
          +
        </button>
      </div>
    </div>
  );
}

type ResultRow = { product: SimulatorProduct; input: number; volume: number; revenue: number };

function StepConfirmation({
  pdfFilename,
  onRestart,
  onClose,
}: {
  pdfFilename: string | null;
  onRestart: () => void;
  onClose: () => void;
}) {
  const responsible = getResponsibleExecutive();
  const exec = responsible.executive;
  const rawWhats = (exec?.whatsapp || exec?.phone || "").replace(/\D/g, "") || WHATSAPP_NUMBER;
  const firstName = exec?.name?.split(" ")[0] ?? "";
  const message =
    responsible.personalized && firstName
      ? `Olá ${firstName}! Concluí a simulação de potencial de receita e gostaria de continuar nossa conversa.`
      : "Olá! Concluí a simulação de potencial de receita no Portal Velox e gostaria de conversar.";
  const whatsUrl = `https://wa.me/${rawWhats}?text=${encodeURIComponent(message)}`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24 text-center">
      <div
        className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: "color-mix(in oklab, var(--brand-orange) 14%, transparent)",
          color: "var(--brand-orange)",
        }}
      >
        <FileCheck2 className="h-7 w-7" />
      </div>
      <span className="portal-eyebrow" style={{ color: "var(--brand-orange)" }}>
        Simulação concluída
      </span>
      <h2
        className="portal-serif mt-4 text-3xl md:text-4xl leading-tight text-balance"
        style={{ color: "var(--brand-blue-deep)" }}
      >
        Seu relatório foi gerado com sucesso e já está disponível para o Executivo responsável.
      </h2>
      <p className="mt-5 text-sm md:text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Uma cópia do PDF{pdfFilename ? ` (${pdfFilename})` : ""} foi baixada no seu dispositivo e
        registrada na sua jornada no Portal Velox — pronta para acompanhar a próxima conversa
        com {responsible.personalized && firstName ? firstName : "seu Executivo de Expansão"}.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-medium transition hover:bg-black/5"
          style={{ borderColor: "var(--brand-blue-deep)", color: "var(--brand-blue-deep)" }}
        >
          <RotateCcw className="h-4 w-4" />
          Nova Simulação
        </button>
        <a
          href={whatsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setTimeout(onClose, 200)}
          className="ed-btn-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
        >
          <MessageCircle className="h-4 w-4" />
          Conversar com meu Executivo
        </a>
      </div>
    </div>
  );
}

function SimulatorFooter({
  step,
  selectedCount,
  canAdvance,
  canCalculate,
  onBack,
  onNext,
  onCalculate,
  onRestart,
  hidden,
}: {
  step: Step;
  selectedCount: number;
  canAdvance: boolean;
  canCalculate: boolean;
  onBack: () => void;
  onNext: () => void;
  onCalculate: () => void;
  onRestart: () => void;
  hidden: boolean;
}) {
  if (hidden) return null;
  return (
    <div
      className="flex items-center justify-between gap-4 border-t px-6 py-4 md:px-10"
      style={{ borderColor: "var(--paper-edge)", background: "color-mix(in oklab, var(--brand-blue-deep) 3%, var(--paper))" }}
    >
      <div className="flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition hover:bg-black/5"
            style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] hover:text-[color:var(--brand-blue-deep)]"
        >
          Reiniciar
        </button>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden text-[12px] text-[color:var(--muted-foreground)] sm:inline">
          {selectedCount} {selectedCount === 1 ? "produto selecionado" : "produtos selecionados"}
        </span>
        {step === 1 && (
          <button
            type="button"
            onClick={onNext}
            disabled={!canAdvance}
            className="ed-btn-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            onClick={onCalculate}
            disabled={!canCalculate}
            className="ed-btn-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Calcular potencial <Calculator className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}