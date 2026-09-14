import { beforeEach, describe, expect, it } from "vitest";
import { portalAssetUrl, setSavedPortalAssets, stagePortalAsset } from "./asset-overrides";

describe("slots editoriais posicionais", () => {
  beforeEach(() => setSavedPortalAssets({}));

  it("resolve específico, depois legado e por fim original", () => {
    setSavedPortalAssets({ "universo-mercado-distrito-financeiro": "legacy.jpg" });
    expect(portalAssetUrl("universo-ch2-panorama-mercado", "original.jpg")).toBe("legacy.jpg");
    stagePortalAsset("universo-ch2-panorama-mercado", "specific.jpg");
    expect(portalAssetUrl("universo-ch2-panorama-mercado", "original.jpg")).toBe("specific.jpg");
  });

  it("mantém posições que usam o mesmo asset independentes", () => {
    stagePortalAsset("universo-ch3-suporte-franqueado", "support.jpg");
    stagePortalAsset("universo-ch3-universidade-corporativa", "university.jpg");
    expect(portalAssetUrl("universo-ch3-suporte-franqueado", "original.jpg")).toBe("support.jpg");
    expect(portalAssetUrl("universo-ch3-universidade-corporativa", "original.jpg")).toBe("university.jpg");
  });
});