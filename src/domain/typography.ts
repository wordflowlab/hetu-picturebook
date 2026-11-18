/** 纯文本断行：保留常见西文词组；仅超长词才逐字拆分。 */
export function wrapLine(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const tokens =
    text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*[.,!?;:]*|./gu) ?? [];
  const lines: string[] = [];
  let row = "";
  for (const token of tokens) {
    if (row && measure(row + token) > maxWidth) {
      lines.push(row.trimEnd());
      row = "";
      if (/^\s+$/.test(token)) continue;
    }
    if (measure(token) > maxWidth) {
      for (const character of token) {
        if (row && measure(row + character) > maxWidth) {
          lines.push(row);
          row = "";
        }
        row += character;
      }
    } else row += token;
  }
  lines.push(row);
  return lines;
}
