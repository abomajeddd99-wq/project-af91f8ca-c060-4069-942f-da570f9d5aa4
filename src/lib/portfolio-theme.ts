/** Normalize legacy brand paints, never teacher text or original evidence bytes. */
export function applyPortfolioPalette(markup: string): string {
  const paints: Record<string, string> = {
    "#07594F": "#07584F",
    "#C5A15B": "#C5A46D",
    "#F7F3EA": "#F8F5EC",
    "#202B2A": "#252A28",
    "#183331": "#252A28",
  };
  return markup.replace(/\b(style|fill|stroke|stop-color)="([^"]*)"/g, (_attribute, name: string, value: string) =>
    `${name}="${value.replace(/#[0-9a-f]{6}\b/gi, (color) => paints[color.toUpperCase()] ?? color)}"`,
  );
}
