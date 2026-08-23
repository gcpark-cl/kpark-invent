export async function getKRXQuote(env, ticker) {
  if (!env.KRX_API_KEY) {
    return { ok:false, mode:"demo", reason:"KRX_API_KEY not configured" };
  }

  // KRX API 키가 발급되면 현재 승인된 공식 명세에 맞춰
  // endpoint / header / query parameters를 여기에 연결하십시오.
  throw new Error("KRX provider mapping is pending official API specification.");
}
