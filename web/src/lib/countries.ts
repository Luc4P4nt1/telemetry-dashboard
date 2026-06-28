// F1 / IOC 3-letter country code → ISO 3166-1 alpha-2 (for flag emoji)
const ISO2: Record<string, string> = {
  NED: "NL", GBR: "GB", FRA: "FR", MEX: "MX", ESP: "ES", MON: "MC",
  CAN: "CA", DEN: "DK", JPN: "JP", THA: "TH", CHN: "CN", GER: "DE",
  NZL: "NZ", ARG: "AR", AUS: "AU", FIN: "FI", USA: "US", BRA: "BR",
  ITA: "IT", AUT: "AT", BEL: "BE", SUI: "CH", SWE: "SE", POL: "PL",
  RUS: "RU", IRL: "IE", POR: "PT", COL: "CO",
};

export function flagEmoji(code3: string | null | undefined): string {
  if (!code3) return "🏁";
  const iso2 = ISO2[code3.toUpperCase()];
  if (!iso2) return "🏁";
  return String.fromCodePoint(
    ...[...iso2].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65))
  );
}
