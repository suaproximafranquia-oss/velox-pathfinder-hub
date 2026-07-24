import { useEffect, useState } from "react";

const KEY = "velox:manual:v1";

type Progress = {
  lastChapterSlug: string | null;
  visited: string[];
};

const empty: Progress = { lastChapterSlug: null, visited: [] };

function read(): Progress {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      lastChapterSlug: parsed.lastChapterSlug ?? null,
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
    };
  } catch {
    return empty;
  }
}

function write(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

export function useJourneyProgress() {
  const [progress, setProgress] = useState<Progress>(empty);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(read());
    setHydrated(true);
  }, []);

  const markVisited = (slug: string) => {
    setProgress((prev) => {
      const next: Progress = {
        lastChapterSlug: slug,
        visited: prev.visited.includes(slug) ? prev.visited : [...prev.visited, slug],
      };
      write(next);
      return next;
    });
  };

  const reset = () => {
    write(empty);
    setProgress(empty);
  };

  return { progress, markVisited, reset, hydrated };
}
