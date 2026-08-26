let cachedToken = null;
let tokenExpiresAt = 0;

async function getKiwoomToken(env) {
  if (!env.KIWOOM_APP_KEY || !env.KIWOOM_APP_SECRET) {
    throw new Error("KIWOOM_APP_KEY 또는 KIWOOM_APP_SECRET이 없습니다.");
  }

  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await fetch("https://api.kiwoom.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: env.KIWOOM_APP_KEY,
      secretkey: env.KIWOOM_APP_SECRET,
    }),
  });

  const data = await response.json();

  if (!response.ok || Number(data.return_code) !== 0 || !data.token) {
    throw new Error(
      `키움 토큰 발급 실패: ${data.return_msg || response.status}`
    );
  }

  cachedToken = data.token;

  // 키움 만료시간 형식과 무관하게 안전하게 일정 시간 캐시
  tokenExpiresAt = now + 20 * 60 * 1000;

  return cachedToken;
}

function num(value) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/^\+/, "");

  const n = Number(cleaned);

  return Number.isFinite(n) ? n : 0;
}

export async function getKiwoomQuote(env, ticker) {
  try {
    const code = String(ticker || "")
      .replace(/\D/g, "")
      .padStart(6, "0");

    if (!/^\d{6}$/.test(code)) {
      return {
        ok: false,
        mode: "live",
        source: "KIWOOM",
        reason: "잘못된 종목코드",
      };
    }

    const token = await getKiwoomToken(env);

    const response = await fetch(
      "https://api.kiwoom.com/api/dostk/stkinfo",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          authorization: `Bearer ${token}`,
          "api-id": "ka10001",
        },
        body: JSON.stringify({
          stk_cd: code,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || Number(data.return_code) !== 0) {
      return {
        ok: false,
        mode: "live",
        source: "KIWOOM",
        reason: data.return_msg || `HTTP ${response.status}`,
        raw: data,
      };
    }

    return {
      ok: true,
      mode: "live",
      source: "KIWOOM",
      data: {
        ticker: data.stk_cd || code,
        name: data.stk_nm || code,

        // 핵심: K-PARK 현재가는 키움 cur_prc 사용
        price: Math.abs(num(data.cur_prc)),

        change: num(data.pred_pre),
        change_rate: num(data.flu_rt),

        open: Math.abs(num(data.open_pric)),
        high: Math.abs(num(data.high_pric)),
        low: Math.abs(num(data.low_pric)),
        basePrice: Math.abs(num(data.base_pric)),

        volume: Math.abs(num(data.trde_qty)),

        kiwoom_raw: data,
      },
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      source: "KIWOOM",
      reason: error?.message || String(error),
    };
  }
}