// Colour for a race-control message based on flag / category.
export function flagColor(flag: string | null, category: string): string {
  const f = (flag ?? "").toUpperCase();
  if (f.includes("RED")) return "var(--brake)";
  if (f.includes("YELLOW")) return "var(--drs)";
  if (f === "GREEN" || f === "CLEAR") return "var(--throttle)";
  if (f === "BLUE") return "var(--speed)";
  if (f.includes("CHEQUERED")) return "#e5e5ea";
  const c = (category ?? "").toUpperCase();
  if (c === "SAFETYCAR") return "var(--drs)";
  if (c === "DRS") return "var(--gear)";
  return "var(--text-dim)";
}
