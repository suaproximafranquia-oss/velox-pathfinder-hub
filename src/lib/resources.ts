/**
 * Centro de Recursos — Etapa 2.
 *
 * Gestão de ativos institucionais reutilizáveis (PDFs, apresentações,
 * vídeos, imagens, materiais comerciais). Cada recurso é uma referência
 * com metadados; o binário pode residir em CDN externa, no Drive, ou
 * ser anexado a documentos da Base de Conhecimento por referência.
 *
 * A Base de Conhecimento pode referenciar recursos por `resourceId` sem
 * duplicar arquivos.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";

export type ResourceKind =
  | "pdf"
  | "apresentacao"
  | "video"
  | "imagem"
  | "documento"
  | "link";

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  pdf: "PDF",
  apresentacao: "Apresentação",
  video: "Vídeo",
  imagem: "Imagem",
  documento: "Documento",
  link: "Link externo",
};

export type ResourceVisibility = "publico" | "restrito";

export type ResourceItem = {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  kind: ResourceKind;
  category?: string;
  version: string;
  author: string;
  keywords: string[];
  url?: string;
  visibility: ResourceVisibility;
  createdAt: string;
  updatedAt: string;
};

const KEY = "atlas:resources:v1";

function readAll(): ResourceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResourceItem[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: ResourceItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function listResources(
  workspaceId: string,
  filter?: { kind?: ResourceKind; query?: string },
): ResourceItem[] {
  const q = (filter?.query ?? "").toLowerCase().trim();
  return readAll()
    .filter((r) => r.workspaceId === workspaceId)
    .filter((r) => (filter?.kind ? r.kind === filter.kind : true))
    .filter((r) => {
      if (!q) return true;
      const hay = `${r.title} ${r.description ?? ""} ${r.category ?? ""} ${r.keywords.join(" ")}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function newResourceId(): string {
  return `rc_${Math.random().toString(36).slice(2, 10)}`;
}

export function createResource(
  input: Omit<ResourceItem, "id" | "createdAt" | "updatedAt">,
  actor: { id: string; name: string; role: string },
): ResourceItem {
  const now = new Date().toISOString();
  const item: ResourceItem = {
    ...input,
    id: newResourceId(),
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(item);
  writeAll(all);
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    module: "recursos",
    action: "Recurso publicado",
    target: item.title,
    details: `${RESOURCE_KIND_LABEL[item.kind]} · v${item.version}`,
    severity: "success",
  });
  emitEvent({
    type: "resource.created",
    actorId: actor.id,
    payload: { id: item.id, kind: item.kind },
  });
  return item;
}

export function updateResource(
  id: string,
  patch: Partial<ResourceItem>,
  actor: { id: string; name: string; role: string },
) {
  const all = readAll();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    module: "recursos",
    action: "Recurso atualizado",
    target: all[i].title,
    severity: "info",
  });
  emitEvent({
    type: "resource.updated",
    actorId: actor.id,
    payload: { id },
  });
}

export function removeResource(
  id: string,
  actor: { id: string; name: string; role: string },
) {
  const all = readAll();
  const removed = all.find((r) => r.id === id);
  writeAll(all.filter((r) => r.id !== id));
  if (removed) {
    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      module: "recursos",
      action: "Recurso removido",
      target: removed.title,
      severity: "warning",
    });
    emitEvent({
      type: "resource.removed",
      actorId: actor.id,
      payload: { id },
    });
  }
}

export function visibleResources(
  items: ResourceItem[],
  audience: "publico" | "interno",
): ResourceItem[] {
  if (audience === "publico") return items.filter((r) => r.visibility === "publico");
  return items;
}