/**
 * هش تعهد داور — باید دقیقاً با تابع CommitHash در سمت Go یکسان باشد:
 *   sha256(fmt.Sprintf("%.6f|%.6f|%s", x, y, nonce))
 */
export async function commitHash(x: number, y: number, nonce: string): Promise<string> {
  const payload = `${x.toFixed(6)}|${y.toFixed(6)}|${nonce}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** مقدار تصادفی امن برای تعهد */
export function randomNonce(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
