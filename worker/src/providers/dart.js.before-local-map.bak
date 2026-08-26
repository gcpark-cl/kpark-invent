import { unzipSync } from "fflate";

let corpMapPromise = null;

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/,/g, "").trim();
  if (!s || s === "-") return 0;
  if (/^\(.*\)$/.test(s)) return -Number(s.slice(1, -1)) || 0;
  return Number(s) || 0;
}

function rate(now, prev) {
  if (!prev) return 0;
  return ((now - prev) / Math.abs(prev)) * 100;
}


function norm(s) {
  return String(s || "").replace(/\s+/g, "").toLowerCase();
}

function findRow(rows, names, sj = null) {
  const targets = names.map(norm);

  let pool = rows;
  if (sj) pool = rows.filter(r => r.sj_div === sj);

  for (const target of targets) {
    const exact = pool.find(r => norm(r.account_nm) === target);
    if (exact) return exact;
  }

  for (const target of targets) {
    const partial = pool.find(r => norm(r.account_nm).includes(target));
    if (partial) return partial;
  }

  return null;
}

function amount(rows, names, field = "thstrm_amount", sj = null) {
  const r = findRow(rows, names, sj);
  return r ? num(r[field]) : 0;
}

async function getCorpMap(apiKey) {
  if (corpMapPromise) return corpMapPromise;

  corpMapPromise = (async () => {
    const res = await fetch(
      `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(apiKey)}`
    );

    if (!res.ok) {
      throw new Error(`DART corpCode HTTP ${res.status}`);
    }

    const zipBytes = new Uint8Array(await res.arrayBuffer());
    const files = unzipSync(zipBytes);
    const firstFile = Object.values(files)[0];

    if (!firstFile) {
      throw new Error("DART corpCode ZIP is empty");
    }

    const xml = new TextDecoder("utf-8").decode(firstFile);
    const map = new Map();
    const re = /<list>([\s\S]*?)<\/list>/g;

    let m;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const corp = block.match(/<corp_code>(.*?)<\/corp_code>/);
      const stock = block.match(/<stock_code>(.*?)<\/stock_code>/);

      if (corp && stock) {
        const stockCode = stock[1].trim();
        const corpCode = corp[1].trim();
        if (stockCode) map.set(stockCode, corpCode);
      }
    }

    return map;
  })();

  return corpMapPromise;
}

async function fetchFinancials(apiKey, corpCode, year, fsDiv) {
  const qs = new URLSearchParams({
    crtfc_key: apiKey,
    corp_code: corpCode,
    bsns_year: String(year),
    reprt_code: "11011",
    fs_div: fsDiv
  });

  const res = await fetch(
    `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?${qs.toString()}`
  );

  if (!res.ok) {
    throw new Error(`DART financial HTTP ${res.status}`);
  }

  return await res.json();
}

async function latestAnnual(apiKey, corpCode) {
  const startYear = new Date().getUTCFullYear() - 1;

  for (let year = startYear; year >= startYear - 3; year--) {
    for (const fsDiv of ["CFS", "OFS"]) {
      const json = await fetchFinancials(apiKey, corpCode, year, fsDiv);

      if (json.status === "000" && Array.isArray(json.list) && json.list.length) {
        return { year, fsDiv, list: json.list };
      }

      if (json.status && !["000", "013"].includes(json.status)) {
        throw new Error(`DART ${json.status}: ${json.message || "API error"}`);
      }
    }
  }

  throw new Error("DART annual financial statements not found");
}

export async function getDARTFundamentals(env, ticker) {
  if (!env.DART_API_KEY) {
    return {
      ok: false,
      mode: "demo",
      reason: "DART_API_KEY not configured"
    };
  }

  try {
    const stockCode = String(ticker || "").padStart(6, "0");
    const corpMap = await getCorpMap(env.DART_API_KEY);
    const corpCode = corpMap.get(stockCode);

    if (!corpCode) {
      return {
        ok: false,
        reason: `DART corp_code not found for ${stockCode}`
      };
    }

    const { year, fsDiv, list } =
      await latestAnnual(env.DART_API_KEY, corpCode);

    const revenueNames = [
      "매출액",
      "수익(매출액)",
      "영업수익",
      "매출"
    ];

    const operatingNames = [
      "영업이익",
      "영업이익(손실)",
      "영업손익"
    ];

    const netIncomeNames = [
      "당기순이익",
      "당기순이익(손실)",
      "연결당기순이익"
    ];

    const revenue = amount(list, revenueNames, "thstrm_amount");
    const prevRevenue = amount(list, revenueNames, "frmtrm_amount");

    const operatingProfit =
      amount(list, operatingNames, "thstrm_amount");

    const prevOperatingProfit =
      amount(list, operatingNames, "frmtrm_amount");

    const netIncome =
      amount(list, netIncomeNames, "thstrm_amount");

    const prevNetIncome =
      amount(list, netIncomeNames, "frmtrm_amount");

    const liabilities = amount(
      list,
      ["부채총계"],
      "thstrm_amount",
      "BS"
    );

    const equity = amount(
      list,
      ["자본총계"],
      "thstrm_amount",
      "BS"
    );

    const prevEquity = amount(
      list,
      ["자본총계"],
      "frmtrm_amount",
      "BS"
    );

    const cash = amount(
      list,
      ["현금및현금성자산", "현금및현금성자산의증가"],
      "thstrm_amount",
      "BS"
    );

    const currentLiabilities = amount(
      list,
      ["유동부채"],
      "thstrm_amount",
      "BS"
    );

    const operatingCashflow = amount(
      list,
      [
        "영업활동으로인한현금흐름",
        "영업활동현금흐름",
        "영업활동으로부터의현금흐름"
      ],
      "thstrm_amount",
      "CF"
    );

    let capex = amount(
      list,
      [
        "유형자산의취득",
        "유형자산취득",
        "유형자산의증가"
      ],
      "thstrm_amount",
      "CF"
    );

    capex = Math.abs(capex);

    const avgEquity =
      equity && prevEquity ? (equity + prevEquity) / 2 : equity;

    const revenueGrowth = rate(revenue, prevRevenue);

    const profitGrowth = rate(
      netIncome || operatingProfit,
      prevNetIncome || prevOperatingProfit
    );

    const roe =
      avgEquity ? (netIncome / avgEquity) * 100 : 0;

    const operatingMargin =
      revenue ? (operatingProfit / revenue) * 100 : 0;

    const netMargin =
      revenue ? (netIncome / revenue) * 100 : 0;

    const debtRatio =
      equity ? (liabilities / equity) * 100 : 0;

    const cashRatio =
      currentLiabilities ? (cash / currentLiabilities) * 100 : 0;

    const freeCashflow = operatingCashflow - capex;

    return {
      ok: true,
      mode: "live",
      data: {
        dart_year: year,
        dart_fs_div: fsDiv,
        corp_code: corpCode,

        revenue,
        operating_profit: operatingProfit,
        net_income: netIncome,

        revenue_growth: revenueGrowth,
        profit_growth: profitGrowth,
        roe,
        operating_margin: operatingMargin,
        net_margin: netMargin,
        debt_ratio: debtRatio,
        cash_ratio: cashRatio,
        operating_cashflow: operatingCashflow,
        free_cashflow: freeCashflow
      }
    };

  } catch (err) {
    return {
      ok: false,
      mode: "live",
      reason: err?.message || String(err)
    };
  }
}
