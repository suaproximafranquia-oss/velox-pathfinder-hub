import { beforeEach, describe, expect, it } from "vitest";
import { 
  portalAssetUrl, 
  setSavedPortalAssets, 
  stagePortalAsset, 
  stagePortalAssetRemoval,
  pendingPortalAssetChanges,
  discardPortalAssetChanges
} from "./asset-overrides";

describe("Portal Asset Overrides - Safety and Flow", () => {
  const FACTORY_URL = "https://cdn.velox.com.br/factory.jpg";
  const SLOT_KEY = "home-capa";

  beforeEach(() => {
    setSavedPortalAssets({});
    discardPortalAssetChanges();
  });

  it("preserves factory asset when no override exists", () => {
    expect(portalAssetUrl(SLOT_KEY, FACTORY_URL)).toBe(FACTORY_URL);
  });

  it("uses staged override immediately (preview flow)", () => {
    const BLOB_URL = "blob:http://localhost/123";
    stagePortalAsset(SLOT_KEY, BLOB_URL);
    expect(portalAssetUrl(SLOT_KEY, FACTORY_URL)).toBe(BLOB_URL);
  });

  it("returns to factory asset after staging removal", () => {
    setSavedPortalAssets({ [SLOT_KEY]: "https://storage.com/saved.jpg" });
    stagePortalAssetRemoval(SLOT_KEY);
    expect(portalAssetUrl(SLOT_KEY, FACTORY_URL)).toBe(FACTORY_URL);
  });

  it("correctly identifies pending changes for rollback/commit", () => {
    stagePortalAsset(SLOT_KEY, "new.jpg");
    const pending = pendingPortalAssetChanges();
    expect(pending.updates).toContainEqual({ key: SLOT_KEY, url: "new.jpg" });
    
    discardPortalAssetChanges();
    expect(portalAssetUrl(SLOT_KEY, FACTORY_URL)).toBe(FACTORY_URL);
  });

  it("prevents stale render by clearing pending state after setSavedPortalAssets", () => {
    stagePortalAsset(SLOT_KEY, "staged.jpg");
    setSavedPortalAssets({ [SLOT_KEY]: "https://storage.com/permanent.jpg" });
    // After saving, pending should be empty and use the new saved URL
    expect(portalAssetUrl(SLOT_KEY, FACTORY_URL)).toBe("https://storage.com/permanent.jpg");
    expect(pendingPortalAssetChanges().updates).toHaveLength(0);
  });
});
