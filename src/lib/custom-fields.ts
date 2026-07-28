/**
 * Campos Personalizados — Etapa 2.
 *
 * Administradores podem criar campos adicionais associados a entidades da
 * plataforma (investidor, executivo, reunião, documento, recurso) sem
 * alteração de código. Persistência local, contrato preparado para backend.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";

export type CustomFieldEntity =
  | "investidor"
  | "executivo"
  | "reuniao"
  | "documento"
  | "recurso";

export const CUSTOM_FIELD_ENTITY_LABEL: Record<CustomFieldEntity, string> = {
  investidor: "Investidor",
  executivo: "Executivo",
  reuniao: "Reunião",
  documento: "Documento",
  recurso: "Recurso",
};

export type CustomFieldType =
  | "text"
  | "longtext"
  | "number"
  | "date"
  | "boolean"
  | "select";

export const CUSTOM_FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Texto curto",
  longtext: "Texto longo",
  number: "Numérico",
  date: "Data",
  boolean: "Sim/Não",
  select: "Lista de opções",
};

export type CustomFieldVisibility = "publico" | "restrito";

export type CustomField = {
  id: string;
  workspaceId: string;
  entity: CustomFieldEntity;
  key: string; // slug técnico
  label: string;
  description?: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue?: string;
  options?: string[]; // para type="select"
  visibility: CustomFieldVisibility;
  createdAt: string;
  updatedAt: string;
};

const KEY = "atlas:custom-fields:v1";

function readAll(): CustomField[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomField[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: CustomField[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function listCustomFields(
  workspaceId: string,
  entity?: CustomFieldEntity,
): CustomField[] {
  return readAll()
    .filter((f) => f.workspaceId === workspaceId)
    .filter((f) => (entity ? f.entity === entity : true))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function newCustomFieldId(): string {
  return `cf_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function createCustomField(
  input: Omit<CustomField, "id" | "createdAt" | "updatedAt" | "key"> & {
    key?: string;
  },
  actor: { id: string; name: string; role: string },
): CustomField {
  const now = new Date().toISOString();
  const field: CustomField = {
    ...input,
    id: newCustomFieldId(),
    key: input.key || slugify(input.label),
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(field);
  writeAll(all);
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    module: "administracao",
    action: "Campo personalizado criado",
    target: `${CUSTOM_FIELD_ENTITY_LABEL[field.entity]} · ${field.label}`,
    severity: "success",
  });
  emitEvent({
    type: "admin.customField.created",
    actorId: actor.id,
    payload: { id: field.id, entity: field.entity },
  });
  return field;
}

export function updateCustomField(
  id: string,
  patch: Partial<CustomField>,
  actor: { id: string; name: string; role: string },
) {
  const all = readAll();
  const i = all.findIndex((f) => f.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    module: "administracao",
    action: "Campo personalizado atualizado",
    target: all[i].label,
    severity: "info",
  });
  emitEvent({
    type: "admin.customField.updated",
    actorId: actor.id,
    payload: { id },
  });
}

export function removeCustomField(
  id: string,
  actor: { id: string; name: string; role: string },
) {
  const all = readAll();
  const removed = all.find((f) => f.id === id);
  writeAll(all.filter((f) => f.id !== id));
  if (removed) {
    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      module: "administracao",
      action: "Campo personalizado removido",
      target: removed.label,
      severity: "warning",
    });
    emitEvent({
      type: "admin.customField.removed",
      actorId: actor.id,
      payload: { id },
    });
  }
}