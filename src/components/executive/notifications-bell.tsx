import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  ensureNotificationsSubscribed,
  listNotifications,
  markAllRead,
  unreadCount,
  type Notification,
} from "@/lib/notifications";
import { onEvent } from "@/lib/events/bus";
import { cn } from "@/lib/utils";

/**
 * Bell discreto no header da Central do Executivo.
 * Popover cronológico com acesso rápido; nunca interrompe fluxo.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureNotificationsSubscribed();
    const refresh = () => {
      setItems(listNotifications());
      setUnread(unreadCount());
    };
    refresh();
    const off = onEvent(refresh);
    return off;
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next && unread > 0) {
        markAllRead();
        setUnread(0);
      }
      return next;
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificações"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[color:var(--gold)] text-[10px] font-medium text-[color:var(--navy-deep)] flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--navy)] shadow-xl z-50">
          <div className="px-4 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              Central de Notificações
            </p>
            <span className="text-[10px] text-[color:var(--muted-foreground)]">
              {items.length} eventos
            </span>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[color:var(--muted-foreground)]">
              Nenhuma notificação ainda.
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {items.map((n) => (
                <li key={n.id} className={cn("px-4 py-3", !n.read && "bg-[color:var(--accent)]/40")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-[color:var(--foreground)]">{n.title}</span>
                    <span className="text-[10px] text-[color:var(--muted-foreground)] whitespace-nowrap">
                      {new Date(n.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed mt-1">
                    {n.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}