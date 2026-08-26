const http = require("http");

const PORT = 8788;
const HOST = "127.0.0.1";
const KIWOOM_BASE = "https://api.kiwoom.com";

let cachedToken = null;
let tokenExpiresAt = 0;

function numberValue(v) {
  if (v === null || v === undefined || v === "") return 0;

  const n = Number(
    String(v)
      .replace(/,/g, "")
      .replace(/^\+/, "")
  );

  return Number.isFinite(n) ? n : 0;
}

async function getToken() {
  const appKey = process.env.KIWOOM_APP_KEY;
  const appSecret = process.env.KIWOOM_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("KIWOOM_APP_KEY / KIWOOM_APP_SECRET 환경변수가 없습니다.");
  }

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const r = await fetch(`${KIWOOM_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      secretkey: appSecret,
    }),
  });

  const d = await r.json();

  if (!r.ok || Number(d.return_code) !== 0 || !d.token) {
    throw new Error(`키움 토큰 실패: ${d.return_msg || r.status}`);
  }

  cachedToken = d.token;

  // 실제 만료보다 충분히 짧게 캐시
  tokenExpiresAt = Date.now() + 20 * 60 * 1000;

  return cachedToken;
}

async function getQuote(code) {
  if (!/^\d{6}$/.test(code)) {
    throw new Error("종목코드는 6자리 숫자여야 합니다.");
  }

  const token = await getToken();

  const r = await fetch(`${KIWOOM_BASE}/api/dostk/stkinfo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      authorization: `Bearer ${token}`,
      "api-id": "ka10001",
    },
    body: JSON.stringify({
      stk_cd: code,
    }),
  });

  const d = await r.json();

  if (!r.ok || Number(d.return_code) !== 0) {
    throw new Error(`키움 현재가 실패: ${d.return_msg || r.status}`);
  }

  return {
    ok: true,
    source: "KIWOOM",
    realtime: true,
    ticker: d.stk_cd || code,
    name: d.stk_nm || code,
    price: Math.abs(numberValue(d.cur_prc)),
    change: numberValue(d.pred_pre),
    change_rate: numberValue(d.flu_rt),
    open: Math.abs(numberValue(d.open_pric)),
    high: Math.abs(numberValue(d.high_pric)),
    low: Math.abs(numberValue(d.low_pric)),
    base_price: Math.abs(numberValue(d.base_pric)),
    volume: Math.abs(numberValue(d.trde_qty)),
    checked_at: new Date().toISOString(),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    if (url.pathname === "/health") {
      res.end(
        JSON.stringify({
          ok: true,
          service: "K-PARK KIWOOM RELAY",
        })
      );
      return;
    }

    if (url.pathname === "/quote") {
      const expectedSecret = process.env.KPARK_RELAY_SECRET;
      const receivedSecret = req.headers["x-kpark-relay-secret"];

      if (
        !expectedSecret ||
        !receivedSecret ||
        receivedSecret !== expectedSecret
      ) {
        res.statusCode = 401;
        res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
        return;
      }

      const code = String(url.searchParams.get("code") || "").trim();
      const data = await getQuote(code);

      res.end(JSON.stringify(data));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: "Not Found" }));
  } catch (e) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        ok: false,
        error: e?.message || String(e),
      })
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`K-PARK KIWOOM RELAY READY`);
  console.log(`http://${HOST}:${PORT}`);
});