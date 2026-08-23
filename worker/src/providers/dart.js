export async function getDARTFundamentals(env, ticker) {
  if (!env.DART_API_KEY) {
    return { ok:false, mode:"demo", reason:"DART_API_KEY not configured" };
  }

  // DART API 키가 발급되면 현재 공식 명세에 맞춰
  // corp_code 조회와 재무제표 endpoint를 연결하십시오.
  throw new Error("DART provider mapping is pending official API specification.");
}
