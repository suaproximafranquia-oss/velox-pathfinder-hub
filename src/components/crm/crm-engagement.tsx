/**
 * ENGAJAMENTO NA FICHA DO INVESTIDOR — leitura direta e objetiva.
 *
 * Mostra apenas fatos registrados pelo Portal: nível, sessões, retornos,
 * tempo ativo, módulos acessados e último acesso.
 */
import { useEffect, useState } from "react";
import {
  getPortalEngagement,
  type PortalEngagementRow,
} from "@/lib/portal-engagement.functions";
import {
  ENGAGEMENT_LEVEL_LABEL,
  MODULE_LABEL,
  RANKED_MODULES,
  engagementLevel,
  formatActiveTime,
  relativeTime,
} from "@/lib/engagement/score";

export function CrmEngagementSummary({ investorId }: { investorId: string }) {
  const [row, setRow] = useState<PortalEngagementRow | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setRow(undefined);
    getPortalEngagement({ data: { investorId } })
      .then((data) => {
        if (active) setRow(data);
      })
      .catch(() => {
        if (active) setRow(null);
      });
    return () => {
      active = false;
    };
  }, [investorId]);

  if (row === undefined) return null;
  if (row === null) {
    return (
      <p className="text-[11px] text-[color:var(--crm-muted)]">
        Sem atividade registrada no Portal até o momento.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--crm-border)] p-3">
      <p className="text-[11px] font-medium">
        {ENGAGEMENT_LEVEL_LABEL[engagementLevel(row)]}
      </p>
      <p className="mt-1 text-[11px] text-[color:var(--crm-muted)]">
        {row.sessions} {row.sessions === 1 ? "sessão" : "sessões"} · {row.returns}{" "}
        {row.returns === 1 ? "retorno" : "retornos"} · {formatActiveTime(row)}
      </p>
      <ul className="mt-2 space-y-0.5 text-[11px]">
        {RANKED_MODULES.map((m) => (
          <li key={m} className="text-[color:var(--crm-muted)]">
            {MODULE_LABEL[m]}:{" "}
            {row.modules[m]
              ? `acessado ${relativeTime(row.modules[m] as string)}`
              : "não acessado"}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-[color:var(--crm-muted)]">
        Último acesso: {relativeTime(row.lastAccessAt)}
      </p>
    </div>
  );
}
