/**
 * Foto institucional do Executivo.
 *
 * A imagem é redimensionada no navegador e gravada no cadastro oficial do
 * usuário (fonte única). Quando não existir foto, toda a plataforma
 * utiliza o avatar padrão com as iniciais do nome oficial.
 */
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { loadUsers, saveUsers, type ExecutiveUser } from "@/lib/executive-auth";

const MAX_SIZE = 320;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = MAX_SIZE;
  canvas.height = MAX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Navegador sem suporte a processamento de imagem.");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    MAX_SIZE,
    MAX_SIZE,
  );
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function ExecutivePhotoCard({
  user,
  fallbackName,
  onChange,
}: {
  user: ExecutiveUser | null;
  fallbackName: string;
  onChange: (u: ExecutiveUser) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const name = user?.name ?? fallbackName;

  function persist(photoUrl: string | undefined) {
    if (!user) return;
    const updated: ExecutiveUser = { ...user, photoUrl };
    saveUsers(loadUsers().map((u) => (u.id === updated.id ? updated : u)));
    onChange(updated);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      persist(await toSquareDataUrl(file));
    } catch {
      setError("Não foi possível processar esta imagem. Tente outro arquivo.");
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40">
      <div className="border-b border-[color:var(--border)]/60 px-5 py-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Foto institucional
        </p>
      </div>
      <div className="flex items-center gap-4 px-5 py-4">
        {user?.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={`Foto de ${name}`}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accent)] font-display text-lg text-[color:var(--gold)]">
            {initialsOf(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[color:var(--muted-foreground)]">
            Usada no seu perfil e nas telas da plataforma que exibem o
            colaborador. Sem foto, aplicamos o avatar padrão.
          </p>
          {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:border-[color:var(--gold)]/40 hover:text-[color:var(--foreground)]"
            >
              <Camera className="h-3 w-3" />
              {user?.photoUrl ? "Trocar foto" : "Enviar foto"}
            </button>
            {user?.photoUrl && (
              <button
                type="button"
                onClick={() => persist(undefined)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
              >
                <Trash2 className="h-3 w-3" /> Remover
              </button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}