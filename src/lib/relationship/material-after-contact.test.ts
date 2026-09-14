import { describe, expect, it } from "vitest";
import { investorManualUrl } from "@/lib/portal-brands";
import { renderMessageSpec } from "@/lib/relationship/messages";
import { isKnownStep } from "@/lib/relationship/step-registry";

describe("envio de material após contato", () => {
  it("é uma finalidade conhecida e independente da cadência", () => {
    expect(isKnownStep("ENVIO_MATERIAL_POS_CONTATO")).toBe(true);
  });

  it("resolve nome e link oficial do Manual sem placeholder residual", () => {
    const result = renderMessageSpec(
      {
        step: "ENVIO_MATERIAL_POS_CONTATO",
        text: "Oi, {{nome_investidor}}. Acesse {{link_manual_investidor}}",
        usesInvestorName: true,
        button: null,
        contentGroup: null,
        bodyIsSourceOfTruth: true,
      },
      {
        executiveName: "Ana",
        portalLink: investorManualUrl("ana"),
        confirmedInvestorName: "Carlos",
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe("Oi, Carlos. Acesse https://portalvelox.com.br/f/ana?m=manual");
    expect(result.body).not.toContain("{{");
  });

  it("mantém o bloqueio de variável desconhecida", () => {
    const result = renderMessageSpec(
      {
        step: "E5",
        text: "{{variavel_desconhecida}}",
        usesInvestorName: false,
        button: null,
        contentGroup: null,
        bodyIsSourceOfTruth: true,
      },
      { executiveName: "Ana", portalLink: investorManualUrl("ana") },
    );
    expect(result).toEqual({
      ok: false,
      reason: "Mensagem contém variável não resolvida — envio bloqueado.",
    });
  });

  it("resolve o convite exclusivo usado pela mensagem operacional E5", () => {
    const invitation = "https://portalvelox.com.br/portal/convite/token-7-dias";
    const result = renderMessageSpec(
      {
        step: "E5",
        text: "Apresentação: {{link_apresentacao}}",
        usesInvestorName: false,
        button: null,
        contentGroup: null,
        bodyIsSourceOfTruth: true,
      },
      { executiveName: "Ana", portalLink: invitation },
    );
    expect(result.ok && result.body).toBe(`Apresentação: ${invitation}`);
  });
});