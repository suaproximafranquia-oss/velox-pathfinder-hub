import { useEffect, useMemo, useState } from "react";
import { X, ArrowRight, ArrowLeft, Check, Calculator, Sparkles, RotateCcw, MessageCircle } from "lucide-react";
import {
  SIMULATOR_PRODUCTS,
  estimateRevenue,
  formatBRL,
  parseBRLInput,
  formatBRLInput,
  type ProductCategory,
  type SimulatorProduct,
} from "@/lib/simulator-products";
import { ExecutiveContactDialog } from "@/components/shared/executive-contact-dialog";

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
  const [contactOpen, setContactOpen] = useState(false);

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
            <StepResults
              rows={results.rows}
              total={results.total}
              byCategory={results.byCategory}
              onRestart={reset}
              onTalk={() => setContactOpen(true)}
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

      <ExecutiveContactDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        material="Simulador de Potencial de Receita"
        triggerLabel="Conversar com Executivo de Expansão"
      />
    </div>
  );
}

function SimulatorHeader({ step, onClose }: { step: Step; onClose: () => void }) {
  const labels = ["Produtos", "Expectativa", "Resultado"];
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
  quantities,
  onChange,
}: {
  products: SimulatorProduct[];
  quantities: Record<string, number>;
  onChange: (id: string, q: number) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8 max-w-3xl">
        <span className="portal-eyebrow">Etapa 2 · Expectativa de produção</span>
        <h2 className="portal-serif mt-3 text-3xl md:text-4xl" style={{ color: "var(--brand-blue-deep)" }}>
          Quantas operações mensais você acredita realizar?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          Considere seu networking, relacionamento e expectativa comercial.
          Ajuste livremente — a projeção é atualizada a partir das quantidades informadas.
        </p>
      </div>

      <div className="space-y-2">
        {products.map((p) => {
          const q = quantities[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4"
              style={{ borderColor: "var(--paper-edge)", background: "var(--paper-2, #fff)" }}
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[p.category] }} />
                <div>
                  <div className="text-[15px] font-medium" style={{ color: "var(--brand-blue-deep)" }}>{p.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">{p.category}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange(p.id, Math.max(0, q - 1))}
                  aria-label={`Diminuir ${p.name}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg transition hover:bg-black/5"
                  style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={q}
                  onChange={(e) => onChange(p.id, Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
                  className="h-10 w-20 rounded-lg border text-center text-[15px] font-semibold outline-none focus:border-[color:var(--brand-orange)]"
                  style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
                />
                <button
                  type="button"
                  onClick={() => onChange(p.id, q + 1)}
                  aria-label={`Aumentar ${p.name}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg transition hover:bg-black/5"
                  style={{ borderColor: "var(--paper-edge)", color: "var(--brand-blue-deep)" }}
                >
                  +
                </button>
                <span className="ml-2 hidden text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] sm:inline">operações / mês</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ResultRow = { product: SimulatorProduct; quantity: number; revenue: number };

function StepResults({
  rows,
  total,
  byCategory,
  onRestart,
  onTalk,
}: {
  rows: ResultRow[];
  total: number;
  byCategory: Map<ProductCategory, number>;
  onRestart: () => void;
  onTalk: () => void;
}) {
  const active = rows.filter((r) => r.quantity > 0);
  const annual = total * 12;
  const catEntries = Array.from(byCategory.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8 max-w-3xl">
        <span className="portal-eyebrow">Etapa 3 · Resultado da simulação</span>
        <h2 className="portal-serif mt-3 text-3xl md:text-4xl" style={{ color: "var(--brand-blue-deep)" }}>
          Seu cenário de potencial de receita.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          Uma visão consolidada da projeção mensal e anual, com o detalhamento por produto e a
          participação de cada categoria no total.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <HighlightCard label="Receita potencial mensal" value={formatBRL(total)} accent tone="orange" />
        <HighlightCard label="Receita potencial anual" value={formatBRL(annual)} tone="navy" />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4" style={{ color: "var(--brand-orange)" }} />
          <span className="text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--brand-blue-deep)" }}>
            Detalhamento por produto
          </span>
          <span className="h-px flex-1" style={{ background: "var(--paper-edge)" }} />
        </div>
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--paper-edge)", background: "var(--paper-2, #fff)" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                <th className="px-5 py-3 font-medium">Produto</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Comissão média</th>
                <th className="px-5 py-3 text-right font-medium">Operações / mês</th>
                <th className="px-5 py-3 text-right font-medium">Receita mensal</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r, i) => (
                <tr
                  key={r.product.id}
                  className="border-t"
                  style={{ borderColor: "var(--paper-edge)", background: i % 2 ? "color-mix(in oklab, var(--brand-blue-deep) 3%, transparent)" : "transparent" }}
                >
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--brand-blue-deep)" }}>{r.product.name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[r.product.category] }} />
                      {r.product.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px]" style={{ color: "var(--muted-foreground)" }}>{r.product.commissionLabel}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.quantity}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums" style={{ color: "var(--brand-blue-deep)" }}>{formatBRL(r.revenue)}</td>
                </tr>
              ))}
              <tr className="border-t-2" style={{ borderColor: "var(--brand-blue-deep)", background: "color-mix(in oklab, var(--brand-blue-deep) 6%, transparent)" }}>
                <td className="px-5 py-4 font-semibold" colSpan={4} style={{ color: "var(--brand-blue-deep)" }}>
                  Receita total estimada
                </td>
                <td className="px-5 py-4 text-right text-lg font-semibold tabular-nums" style={{ color: "var(--brand-orange)" }}>
                  {formatBRL(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--brand-blue-deep)" }}>
            Participação por categoria
          </span>
          <span className="h-px flex-1" style={{ background: "var(--paper-edge)" }} />
        </div>
        <div className="space-y-3 rounded-xl border p-5" style={{ borderColor: "var(--paper-edge)", background: "var(--paper-2, #fff)" }}>
          {catEntries.map(([cat, value]) => {
            const pct = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={cat}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2" style={{ color: "var(--brand-blue-deep)" }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
                    {cat}
                  </span>
                  <span className="tabular-nums text-[color:var(--muted-foreground)]">
                    {formatBRL(value)} · {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "color-mix(in oklab, var(--brand-blue-deep) 8%, transparent)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p
        className="mt-10 rounded-xl border px-5 py-4 text-[12px] leading-relaxed"
        style={{ borderColor: "var(--paper-edge)", background: "color-mix(in oklab, var(--brand-orange) 6%, transparent)", color: "var(--brand-blue-deep)" }}
      >
        <strong>Aviso:</strong> Esta simulação possui caráter exclusivamente ilustrativo e educacional.
        Os percentuais utilizados representam parâmetros médios definidos apenas para fins de simulação.
        As comissões reais podem variar conforme instituição financeira, produto comercializado, taxas negociadas,
        campanhas vigentes, prazo da operação, perfil do cliente e desempenho comercial do franqueado.
        Esta ferramenta não representa promessa ou garantia de faturamento.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-medium transition hover:bg-black/5"
          style={{ borderColor: "var(--brand-blue-deep)", color: "var(--brand-blue-deep)" }}
        >
          <RotateCcw className="h-4 w-4" />
          Realizar nova simulação
        </button>
        <button
          type="button"
          onClick={onTalk}
          className="ed-btn-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
        >
          <MessageCircle className="h-4 w-4" />
          Conversar com um Executivo de Expansão
        </button>
      </div>
    </div>
  );
}

function HighlightCard({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone: "orange" | "navy" }) {
  const isOrange = tone === "orange";
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-6"
      style={{
        borderColor: isOrange ? "color-mix(in oklab, var(--brand-orange) 40%, transparent)" : "var(--paper-edge)",
        background: isOrange
          ? "linear-gradient(135deg, color-mix(in oklab, var(--brand-orange) 14%, var(--paper)) 0%, var(--paper-2, #fff) 100%)"
          : "linear-gradient(135deg, color-mix(in oklab, var(--brand-blue-deep) 8%, var(--paper)) 0%, var(--paper-2, #fff) 100%)",
      }}
    >
      <div className="portal-eyebrow" style={{ color: isOrange ? "var(--brand-orange)" : "var(--brand-blue-deep)" }}>
        {label}
      </div>
      <div
        className="portal-serif mt-3 text-4xl md:text-5xl tabular-nums"
        style={{ color: accent ? "var(--brand-orange)" : "var(--brand-blue-deep)" }}
      >
        {value}
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