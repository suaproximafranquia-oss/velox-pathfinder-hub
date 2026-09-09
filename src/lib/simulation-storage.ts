import { z } from "zod";

export const simulationSchema = z.object({
  id: z.string().uuid(), investorId: z.string().min(3).max(150),
  createdAt: z.string().datetime(), filename: z.string().min(1).max(200),
  pdfDataUri: z.string().max(14_000_000),
  total: z.number().finite().nonnegative(), annual: z.number().finite().nonnegative(),
  products: z.array(z.object({ id: z.string(), name: z.string(), category: z.string(), volume: z.number().finite().nonnegative(), revenue: z.number().finite().nonnegative() })).max(100),
  executiveName: z.string().nullable(), audienceLabel: z.string().nullable(), interests: z.array(z.string()).max(100),
});

export function simulationDirectory(investorId: string): string {
  return `financeira/simulations/${encodeURIComponent(investorId)}`;
}

export function decodeSimulationPdf(uri: string): Uint8Array {
  const match = /^data:application\/pdf(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(uri);
  if (!match?.[1]) throw new Error("PDF inválido.");
  const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
  if (bytes.length > 10_000_000 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("PDF inválido ou muito grande.");
  return bytes;
}