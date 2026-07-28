import { Info } from "lucide-react";
import type { ExecutiveSession } from "@/lib/executive-auth";
import { GOOGLE_SCOPES } from "@/lib/google-workspace";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12S6.8 21.4 12 21.4c6.9 0 9.5-4.8 9.5-8.6 0-.6-.1-1-.1-1.5H12z"/>
      <path fill="#34A853" d="M3.9 7.4l3.2 2.4C8 8.4 9.9 7.4 12 7.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 4.9 14.7 3.9 12 3.9 8 3.9 4.6 6.1 3.9 7.4z"/>
      <path fill="#FBBC05" d="M12 21.4c2.7 0 4.9-.9 6.5-2.4l-3.1-2.4c-.8.6-2 1.1-3.4 1.1-2.6 0-4.8-1.7-5.6-4.1L3.2 16C4.8 19.2 8.1 21.4 12 21.4z"/>
      <path fill="#4285F4" d="M21.4 12.8c0-.6-.1-1-.1-1.5H12v3.9h5.5c-.3 1.4-1.4 2.5-2.6 3.2l3.1 2.4c1.8-1.7 3.4-4.2 3.4-8z"/>
    </svg>
  );
}

/**
 * Google Workspace — estado neutro oficial.
 *
 * A integração OAuth real com Google Calendar/Meet/Drive ainda não está
 * configurada nesta versão do Portal Velox. Enquanto as credenciais
 * oficiais não forem provisionadas, apresentamos apenas um estado neutro
 * ("Integração não configurada"). Nunca simulamos uma conta conectada
 * nem geramos dados fictícios de usuário.
 */
export function GoogleWorkspaceCard({ session: _session }: { session: ExecutiveSession }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg mb-3">Google Workspace</h2>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60">
            <GoogleIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base">Conta Google</p>
            <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed mt-1">
              A integração oficial com Google Calendar, Google Meet e Google
              Drive será habilitada assim que as credenciais OAuth do Portal
              Velox forem provisionadas.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              <Info className="h-3 w-3" /> Integração não configurada
            </span>
          </div>
        </div>

        <div className="mt-5 border-t border-[color:var(--border)]/60 pt-5">
          <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
            Nenhuma conta conectada. O botão de autenticação será
            disponibilizado assim que o Portal Velox concluir o
            provisionamento oficial das credenciais Google. Até lá, não é
            possível vincular contas, criar eventos no Calendar nem gerar
            links do Google Meet a partir desta tela.
          </p>
        </div>

        <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Escopos previstos: Google Calendar · Google Meet · Perfil · E-mail
        </p>
        <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
          {GOOGLE_SCOPES.length} permissões serão solicitadas — nenhuma além do necessário para as integrações do Portal.
        </p>
      </div>
    </section>
  );
}
