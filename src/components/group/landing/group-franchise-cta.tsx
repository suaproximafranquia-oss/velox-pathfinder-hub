/**
 * Seção "Seja um Franqueado" (#seja-um-franqueado).
 *
 * O visitante escolhe qual frente despertou seu interesse. Para Solar e
 * Seguros o formulário OFICIAL existente (`unit-interest-form.tsx`) é
 * reaproveitado sem alteração. Para a Financeira NÃO existe caminho de
 * captação equivalente neste formulário (ele só aceita `solar` e
 * `seguros`) — e nenhuma estrutura paralela foi criada: a interface fica
 * preparada e informa a limitação.
 */
import { useState } from "react";
import { Building2, ShieldCheck, Sun } from "lucide-react";
import { UnitInterestForm } from "@/components/group/unit-interest-form";
import type { CompanyKey } from "./group-content";
import { GroupReveal } from "./group-reveal";

const CHOICES: Array<{ key: CompanyKey; label: string; icon: typeof Building2 }> = [
  { key: "financeira", label: "Velox Soluções Financeiras", icon: Building2 },
  { key: "solar", label: "Velox Solar", icon: Sun },
  { key: "seguros", label: "Velox Seguros", icon: ShieldCheck },
];

export function GroupFranchiseCta() {
  const [choice, setChoice] = useState<CompanyKey>("financeira");

  return (
    <section
      id="seja-um-franqueado"
      className="relative scroll-mt-20 overflow-hidden bg-[#070d1f] py-20 md:py-28"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#e8873a]/10 to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-6 md:px-10">
        <GroupReveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Seja um <span className="text-[#e8873a]">Franqueado</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/55">
            Escolha a frente que despertou seu interesse. A conversa começa com informação clara,
            sem promessa de retorno rápido.
          </p>
        </GroupReveal>

        <GroupReveal delay={100} className="mt-10">
          <div className="grid gap-3 sm:grid-cols-3">
            {CHOICES.map((option) => {
              const Icon = option.icon;
              const active = option.key === choice;
              return (
                <button
                  key={option.key}
                  onClick={() => setChoice(option.key)}
                  aria-pressed={active}
                  className={`flex items-center gap-3 rounded-2xl border p-5 text-left transition ${
                    active
                      ? "border-[#e8873a] bg-[#e8873a]/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0 text-[#e8873a]" aria-hidden />
                  <span className="text-sm font-medium leading-snug">{option.label}</span>
                </button>
              );
            })}
          </div>
        </GroupReveal>

        <GroupReveal delay={160} className="mt-8">
          <div className="rounded-3xl border border-white/10 bg-[#0b1226] p-6 md:p-10">
            {choice === "financeira" ? (
              <div className="mx-auto max-w-xl text-center">
                <h3 className="text-lg font-semibold text-white">Velox Soluções Financeiras</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  O interesse na frente de Soluções Financeiras é conduzido pelo canal oficial da
                  unidade. Esta página institucional ainda não possui o formulário dessa frente —
                  nenhum caminho paralelo de captação foi criado.
                </p>
                <p className="mt-4 text-xs text-white/40">
                  Interface preparada para receber o formulário oficial quando ele for
                  disponibilizado para o ambiente institucional.
                </p>
              </div>
            ) : (
              <UnitInterestForm unit={choice} fromGroup />
            )}
          </div>
        </GroupReveal>
      </div>
    </section>
  );
}
