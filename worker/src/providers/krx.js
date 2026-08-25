export async function getKRXQuote(env, tickerOrBasDd, basDd) {
  if (!env.KRX_API_KEY) {
    return {
      ok: false,
      mode: "demo",
      reason: "KRX_API_KEY not configured"
    };
  }

  // /api/krx-test?basDd=20260824 호환
  // 상세분석에서는 tickerOrBasDd = "005930"
  let ticker = tickerOrBasDd || null;
  let requestedDate = basDd || null;

  if (/^\d{8}$/.test(String(tickerOrBasDd || "")) && !basDd) {
    requestedDate = String(tickerOrBasDd);
    ticker = null;
  }

  const toYmd = (d) =>
    d.toISOString().slice(0, 10).replace(/-/g, "");

  const parseYmd = (s) =>
    new Date(
      Date.UTC(
        Number(s.slice(0, 4)),
        Number(s.slice(4, 6)) - 1,
        Number(s.slice(6, 8))
      )
    );

  // 한국시간 기준 오늘
  const koreaNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const startDate = requestedDate
    ? parseYmd(requestedDate)
    : new Date(
        Date.UTC(
          koreaNow.getUTCFullYear(),
          koreaNow.getUTCMonth(),
          koreaNow.getUTCDate()
        )
      );

  // 날짜를 직접 지정한 테스트는 해당 날짜만,
  // 종목 상세분석은 휴일/당일 데이터 미생성을 고려해 최근 7일 검색
  const daysToTry = requestedDate ? 1 : 7;

  for (let i = 0; i < daysToTry; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() - i);
    const date = toYmd(d);

    const url =
      `https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd?basDd=${date}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "AUTH_KEY": env.KRX_API_KEY,
        "Accept": "application/json"
      }
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        `KRX HTTP ${res.status}: ${text.slice(0, 300)}`
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `KRX returned non-JSON: ${text.slice(0, 300)}`
      );
    }

    // 기존 KRX 테스트 기능은 원본 JSON 그대로 반환
    if (!ticker) {
      return {
        ok: true,
        mode: "live",
        basDd: date,
        data
      };
    }

    const rows =
      data.OutBlock_1 ||
      data.OutBlock1 ||
      data.output ||
      [];

    const code = String(ticker).padStart(6, "0");

    const row = rows.find(
      (r) => String(r.ISU_CD || "").padStart(6, "0") === code
    );

    if (row) {
      return {
        ok: true,
        mode: "live",
        basDd: date,
        data: {
          ticker: code,
          name: row.ISU_NM || code,
          market: row.MKT_NM || "",
          price: Number(row.TDD_CLSPRC || 0),

          change: Number(row.CMPPREVDD_PRC || 0),
          change_rate: Number(row.FLUC_RT || 0),
          open: Number(row.TDD_OPNPRC || 0),
          high: Number(row.TDD_HGPRC || 0),
          low: Number(row.TDD_LWPRC || 0),

          volume: Number(row.ACC_TRDVOL || 0),
          trading_value: Number(row.ACC_TRDVAL || 0),
          market_cap: Number(row.MKTCAP || 0),
          listed_shares: Number(row.LIST_SHRS || 0),

          krx_raw: row
        }
      };
    }
  }

  return {
    ok: false,
    mode: "live",
    reason: `KRX ticker not found: ${ticker}`
  };
}