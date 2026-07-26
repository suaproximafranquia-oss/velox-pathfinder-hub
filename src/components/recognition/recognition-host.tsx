/**
 * RecognitionHost — monta o próximo evento pendente do usuário logado.
 * Deve ser incluído uma única vez na shell autenticada.
 */
import { useEffect, useState } from "react";
import {
  evaluateForLogin,
  markViewed,
  nextPendingEvent,
  type RecognitionEvent,
} from "@/lib/recognition/engine";
import { RecognitionModal } from "./recognition-modal";

export function RecognitionHost({ userId }: { userId: string }) {
  const [event, setEvent] = useState<RecognitionEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Avalia regras de disparo (homologação, aniversário real futuro, etc.).
    evaluateForLogin(userId);
    setEvent(nextPendingEvent(userId));
  }, [userId]);

  if (!event) return null;
  return (
    <RecognitionModal
      event={event}
      onContinue={() => {
        markViewed(event.id);
        setEvent(nextPendingEvent(userId));
      }}
    />
  );
}