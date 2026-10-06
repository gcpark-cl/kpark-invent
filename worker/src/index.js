import {getMarketInfo} from "./market-master.js";
import {analyzeDetailed} from "./engine.js";
import {getKRXQuote} from "./providers/krx.js";
import {getKiwoomQuote} from "./providers/kiwoom.js";
import {getDARTFundamentals,getDARTFinancialHistory,getDARTAnnualReportDates} from "./providers/dart.js";
import infraAssetData from "./data/infra-asset-data.json" with { type: "json" };
import {getCompanyType} from "./company-type.js";
import {getValuationType} from "./valuation-type.js";

let nhplugMemoryToken=null;
let nhplugMemoryExpiresAt=0;

const J=(x,s=200)=>new Response(JSON.stringify(x),{
  status:s,
  headers:{
    "content-type":"application/json;charset=UTF-8",
    "cache-control":"no-store"
  }
});
async function getKiwoomRelayQuote(env, ticker) {
  if (!env.KIWOOM_RELAY_URL || !env.KPARK_RELAY_SECRET) {
    return { ok: false, reason: "KIWOOM relay config missing" };
  }

  try {
    const url =
      env.KIWOOM_RELAY_URL.replace(/\/$/, "") +
      "/quote?code=" +
      encodeURIComponent(ticker);

    const r = await fetch(url, {
      headers: {
        "x-kpark-relay-secret": env.KPARK_RELAY_SECRET
      }
    });

    const data = await r.json();

    if (!r.ok || !data.ok) {
      return {
        ok: false,
        reason: data.error || `HTTP ${r.status}`
      };
    }

    return {
      ok: true,
      data: {
        ticker: data.ticker,
        name: data.name,
        price: Number(data.price || 0),
        gongprice: Number(data.gongprice || 0) || null,
        change: Number(data.change || 0),
        change_rate: Number(data.change_rate || 0),
        open: Number(data.open || 0),
        high: Number(data.high || 0),
        low: Number(data.low || 0),
        volume: Number(data.volume || 0),
        source: "KIWOOM"
      }
    };
  } catch (e) {
    return {
      ok: false,
      reason: e?.message || String(e)
    };
  }
}

async function getCyclicalMarketContext(env, ticker){
  try{
    if(!env.DB) return {ok:false, reason:"D1_NOT_BOUND"};

    const currentYearStart=`${new Date().getUTCFullYear()}0101`;

    const result=await env.DB.prepare(`
      WITH ranked AS (
        SELECT
          substr(date,1,4) AS yr,
          close,
          ROW_NUMBER() OVER(
            PARTITION BY substr(date,1,4)
            ORDER BY close
          ) AS rn,
          COUNT(*) OVER(
            PARTITION BY substr(date,1,4)
          ) AS cnt
        FROM prices
        WHERE ticker=?
          AND close>0
          AND date<?
      ),
      med AS (
        SELECT
          yr,
          cnt AS trading_days,
          AVG(close) AS median_close
        FROM ranked
        WHERE rn IN ((cnt+1)/2,(cnt+2)/2)
        GROUP BY yr,cnt
        HAVING cnt>=180
      )
      SELECT
        m.yr,
        m.trading_days,
        m.median_close,
        f.eps,
        f.bps,
        CASE
          WHEN f.eps>0 THEN m.median_close/f.eps
          ELSE NULL
        END AS observed_per,
        CASE
          WHEN f.bps>0 THEN m.median_close/f.bps
          ELSE NULL
        END AS observed_pbr
      FROM med m
      JOIN fundamentals f
        ON f.ticker=?
       AND f.period=m.yr
      ORDER BY m.yr DESC
      LIMIT 5
    `).bind(String(ticker),currentYearStart,String(ticker)).all();

    const allRows=Array.isArray(result?.results) ? result.results : [];

    const rows=allRows.filter(r =>
      Number.isFinite(Number(r.observed_per)) &&
      Number(r.observed_per)>0
    );

    if(!rows.length){
      return {ok:false, reason:"MARKET_PER_HISTORY_UNAVAILABLE"};
    }

    const values=rows
      .map(r=>Number(r.observed_per))
      .sort((a,b)=>a-b);

    const mid=Math.floor(values.length/2);

    const median=
      values.length%2
        ? values[mid]
        : (values[mid-1]+values[mid])/2;

    const pbrRows=allRows.filter(r =>
      Number.isFinite(Number(r.observed_pbr)) &&
      Number(r.observed_pbr)>0
    );

    let pbrMedian=null;

    if(pbrRows.length){
      const pbrValues=pbrRows
        .map(r=>Number(r.observed_pbr))
        .sort((a,b)=>a-b);

      const pbrMid=Math.floor(pbrValues.length/2);

      pbrMedian=
        pbrValues.length%2
          ? pbrValues[pbrMid]
          : (pbrValues[pbrMid-1]+pbrValues[pbrMid])/2;
    }

    return {
      ok:true,
      market_per_anchor:median,
      market_per_years:rows.length,
      market_per_history:rows,
      market_pbr_anchor:pbrMedian,
      market_pbr_years:pbrRows.length,
      market_pbr_history:pbrRows
    };
  }catch(err){
    return {
      ok:false,
      reason:err?.message || String(err)
    };
  }
}
async function attachCyclicalMarketContext(env,ticker,merged){
  const companyType=getCompanyType(merged?.name,merged?.sector);
  const valuationType=getValuationType(
    {ticker,name:merged?.name,sector:merged?.sector},
    companyType
  );

  if(valuationType?.valuation_type !== "CYCLICAL_TECH"){
    return merged;
  }

  const ctx=await getCyclicalMarketContext(env,ticker);

  if(ctx.ok){
    merged.market_per_anchor=ctx.market_per_anchor;
    merged.market_per_years=ctx.market_per_years;
    merged.market_per_history=ctx.market_per_history;
    merged.market_pbr_anchor=ctx.market_pbr_anchor;
    merged.market_pbr_years=ctx.market_pbr_years;
    merged.market_pbr_history=ctx.market_pbr_history;
  }else{
    merged.market_per_anchor=null;
    merged.market_per_years=0;
    merged.market_per_history=[];
    merged.market_pbr_anchor=null;
    merged.market_pbr_years=0;
    merged.market_pbr_history=[];
  }

  return merged;
}

async function getD1Fundamentals(env, ticker){
  try{
    if(!env.DB) return {ok:false, reason:"D1_NOT_BOUND"};

    const row = await env.DB.prepare(`
      SELECT *
      FROM fundamentals
      WHERE ticker = ?
      ORDER BY period DESC
      LIMIT 1
    `).bind(String(ticker)).first();

    if(!row) return {ok:false, reason:"D1_FUNDAMENTALS_NOT_FOUND"};

    const hasEps = Number.isFinite(Number(row.eps)) && Number(row.eps) !== 0;
    const hasEquity = Number.isFinite(Number(row.equity)) && Number(row.equity) > 0;
    const hasBps = Number.isFinite(Number(row.bps)) && Number(row.bps) > 0;

    if(!hasEps && !hasEquity && !hasBps){
      return {ok:false, reason:"D1_FUNDAMENTALS_INCOMPLETE"};
    }

    return {
      ok:true,
      mode:"cache",
      data:row
    };
  }catch(err){
    return {
      ok:false,
      reason:err?.message || String(err)
    };
  }
}


async function getD1FinancialHistory(env, ticker, count = 5){
  try{
    if(!env.DB) return {ok:false, reason:"D1_NOT_BOUND"};

    const n = Math.max(1, Math.min(5, Math.trunc(Number(count) || 5)));

    const result = await env.DB.prepare(`
      SELECT *
      FROM fundamentals
      WHERE ticker = ?
      ORDER BY period DESC
      LIMIT ?
    `).bind(String(ticker), n).all();

    const rows = Array.isArray(result?.results) ? result.results : [];

    if(!rows.length){
      return {ok:false, reason:"D1_HISTORY_NOT_FOUND"};
    }

    return {
      ok:true,
      mode:"cache",
      history:rows
    };
  }catch(err){
    return {
      ok:false,
      reason:err?.message || String(err)
    };
  }
}

async function getFundamentalsWithFallback(env, ticker){
  const cached = await getD1Fundamentals(env, ticker);

  if(cached.ok){
    const mi = getMarketInfo(ticker) || {};
    const companyType = getCompanyType(mi.name, mi.sector);
    const valuationType = getValuationType(
      {ticker, name:mi.name, sector:mi.sector},
      companyType
    );

    if(valuationType?.valuation_type === "REIT_NAV"){
      const live = await getDARTFundamentals(env, ticker);

      if(live.ok){
        return live;
      }
    }

    return cached;
  }

  return await getDARTFundamentals(env, ticker);
}

async function analyzeTicker(ticker,env){
  if(ticker.length===6){
    const [n,k,f,h]=await Promise.all([
      getNhplugQuote(env,ticker),
      getKRXQuote(env,ticker).catch(e=>({ok:false,mode:"unavailable",reason:e?.message||String(e)})),
      getFundamentalsWithFallback(env,ticker),
      getD1FinancialHistory(env,ticker,5)
    ]);

    if(n.ok){
      const mi=getMarketInfo(ticker)||{};
      const merged={
        ...mi,
        ...(f.data || {}),
        ...(infraAssetData[ticker] || {}),
        ...(k.ok ? k.data : {}),
        ...n.data
      };

      merged.name = mi.name || merged.name;

      if(!merged.sector){
        merged.sector = mi.sector || null;
      }

      if(f.data?.equity > 0 && (!f.data?.equity_currency || f.data.equity_currency === "KRW")){
        const bpsShares = f.data?.total_issued_shares > 0
          ? f.data.total_issued_shares
          : (k.data?.listed_shares > 0 ? k.data.listed_shares : null);

        if (bpsShares) {
          merged.bps = f.data.equity / bpsShares;
        }
        if (f.data?.dps > 0 && merged.price > 0) {
          merged.dividend_yield = (f.data.dps / merged.price) * 100;
        }
      }

      await attachCyclicalMarketContext(env,ticker,merged);

      return {
        ticker,
        name:merged.name,
        market:merged.market,
        sector:merged.sector,
        price:merged.price,
        gongprice:merged.gongprice ?? null,
        dart_year: merged.dart_year,
        dart_fs_div: merged.dart_fs_div,
        equity: merged.equity,
        total_assets: merged.total_assets,
        total_liabilities: merged.total_liabilities,
        investment_property: merged.investment_property,
        cash: merged.cash,
        capex: merged.capex,
        short_term_debt: merged.short_term_debt,
        current_long_term_debt: merged.current_long_term_debt,
        bonds: merged.bonds,
        long_term_debt: merged.long_term_debt,
        total_debt: merged.total_debt,
        net_debt: merged.net_debt,
        operating_cashflow: merged.operating_cashflow,
        free_cashflow: merged.free_cashflow,
        mode:"live",
        version:env.APP_VERSION||"3.0.0",
        ...analyzeDetailed({...merged,financial_history:h.ok?h.history:[],fundamentals_available:!!f.ok,source_nhplug_ok:!!n.ok,source_krx_ok:!!k.ok,fundamentals_ok:!!f.ok,fundamentals_mode:f.mode||null,source_dart_live:f.mode!=="cache"&&!!f.ok})
      };
    }
  }
if(env.APP_MODE==="live" && env.KRX_API_KEY && env.DART_API_KEY){
  const [k,q,f,h]=await Promise.all([
    getNhplugQuote(env,ticker),
    getKRXQuote(env,ticker).catch(e=>({ok:false,mode:"unavailable",reason:e?.message||String(e)})),
    getFundamentalsWithFallback(env,ticker),
    getD1FinancialHistory(env,ticker,5)
  ]);
   if(q.ok){
  const merged={
    ...(getMarketInfo(ticker)||{}),
    ...q.data,
    ...(f.data || {}),
    ...(k.ok ? k.data : {})
  };

  merged.name = getMarketInfo(ticker)?.name || merged.name;

  if(!merged.sector){
    merged.sector = getMarketInfo(ticker)?.sector || null;
  }

  if (f.data?.equity > 0 && (!f.data?.equity_currency || f.data.equity_currency === "KRW")) {
    const bpsShares = f.data?.total_issued_shares > 0
      ? f.data.total_issued_shares
      : (q.data?.listed_shares > 0 ? q.data.listed_shares : null);

    if (bpsShares) {
      merged.bps = f.data.equity / bpsShares;
    }

    if (f.data?.dps !== null && f.data?.dps !== undefined && merged.price > 0) {
      merged.dividend_yield = (f.data.dps / merged.price) * 100;
    }
  }

      await attachCyclicalMarketContext(env,ticker,merged);

      return {
        ticker,
        name:merged.name,
        market:merged.market,
        sector:merged.sector,
        price:merged.price,
        dart_year: merged.dart_year,
        dart_fs_div: merged.dart_fs_div,
        equity: merged.equity,
        total_assets: merged.total_assets,
        total_liabilities: merged.total_liabilities,
        investment_property: merged.investment_property,
        cash: merged.cash,
        capex: merged.capex,
        short_term_debt: merged.short_term_debt,
        current_long_term_debt: merged.current_long_term_debt,
        bonds: merged.bonds,
        long_term_debt: merged.long_term_debt,
        total_debt: merged.total_debt,
        net_debt: merged.net_debt,
        operating_cashflow: merged.operating_cashflow,
        free_cashflow: merged.free_cashflow,
        mode:"live",
        version:env.APP_VERSION||"3.0.0",
        ...analyzeDetailed({...merged,financial_history:h.ok?h.history:[],fundamentals_available:!!f.ok,source_nhplug_ok:!!k.ok,source_krx_ok:!!q.ok,fundamentals_ok:!!f.ok,fundamentals_mode:f.mode||null,source_dart_live:f.mode!=="cache"&&!!f.ok})
      };
    }
  }
  const mi=getMarketInfo(ticker)||{};

  return {
    ticker,
    name:mi.name || null,
    market:mi.market || null,
    sector:mi.sector || null,
    price:null,
    mode:"live_unavailable",
    version:env.APP_VERSION||"3.0.0",
    score:null,
    decision:"waiting for live data",
    message:"Live market data is unavailable."
  };
}

export default {
 async fetch(req,env){
  const u=new URL(req.url);

  try{
   if(u.pathname==="/api/health"){
     return J({ok:true,service:"K-PARK",version:env.APP_VERSION||"3.0.0",mode:env.APP_MODE||"live"});
   }
if(u.pathname==="/api/kiwoom-direct-test"){
  try{
    const r = await getKiwoomQuote(env, "005930");
    return J(r);
  }catch(e){
    return J({ok:false,error:e?.message || String(e)},500);
  }
}
   if(u.pathname==="/api/nhplug-direct-test"){ try{ return J(await getNhplugDirectQuote(env,u.searchParams.get("ticker")||"005930")); }catch(e){ return J({ok:false,error:e?.message||String(e)},500); } }
if(u.pathname==="/api/providers"){
     return J({
       ok:true,
       version:env.APP_VERSION||"3.0.0",
       krx_configured:!!env.KRX_API_KEY,
       dart_configured:!!env.DART_API_KEY,
       live_enabled:env.APP_MODE==="live"
     });
   }

    if(u.pathname==="/api/dart-key-test"){ const url=`https://opendart.fss.or.kr/api/company.json?crtfc_key=${encodeURIComponent(env.DART_API_KEY)}&corp_code=00126380`; const r=await fetch(url,{redirect:"manual",headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json,text/plain,*/*"}}); return J({ok:r.ok,status:r.status,location:r.headers.get("location"),body:(await r.text()).slice(0,200)}); }
      if(u.pathname==="/api/dart-company-test"){ const q=new URLSearchParams({crtfc_key:env.DART_API_KEY,corp_code:"00126380"}); const r=await fetch("https://opendart.fss.or.kr/api/company.json?"+q.toString(),{headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json"},redirect:"manual"}); return J({ok:r.ok,status:r.status,location:r.headers.get("location"),body:(await r.text()).slice(0,500)}); }
    if(u.pathname==="/api/dart-key-check"){ return J({ok:true,exists:!!env.DART_API_KEY,length:env.DART_API_KEY?.length||0}); }
    if(u.pathname==="/api/dart-simple-test"){ const q=new URLSearchParams({crtfc_key:env.DART_API_KEY,corp_code:"00126380",bsns_year:"2024",reprt_code:"11011"}); const r=await fetch("https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?"+q.toString(),{redirect:"manual"}); return J({ok:r.ok,status:r.status,location:r.headers.get("location"),body:(await r.text()).slice(0,300)}); } 
      if(u.pathname==="/api/dart-fin-test"){ const q=new URLSearchParams({crtfc_key:env.DART_API_KEY,corp_code:"00126380",bsns_year:"2024",reprt_code:"11011",fs_div:"CFS"}); const r=await fetch("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?"+q.toString(),{redirect:"manual"}); return J({ok:r.ok,status:r.status,location:r.headers.get("location"),body:(await r.text()).slice(0,300)}); } 


      if(u.pathname==="/api/dart-sequence-test"){
        const q1=new URLSearchParams({
          corp_code:"00126380",
          bsns_year:"2025",
          reprt_code:"11011",
          fs_div:"CFS"
        });

        const r1=await fetch(
          `${env.DART_RELAY_URL}/financials?${q1.toString()}`,
          {headers:{"x-kpark-relay-secret":env.KPARK_RELAY_SECRET}}
        );

        const j1=await r1.json();

        const q2=new URLSearchParams({
          corp_code:"00126380",
          bsns_year:"2025",
          reprt_code:"11011"
        });

        const r2=await fetch(
          `${env.DART_RELAY_URL}/dividend?${q2.toString()}`,
          {headers:{"x-kpark-relay-secret":env.KPARK_RELAY_SECRET}}
        );

        const j2=await r2.json();

        return J({
          financials_ok:r1.ok,
          financials_status:r1.status,
          financials_count:Array.isArray(j1.list)?j1.list.length:0,
          dividend_ok:r2.ok,
          dividend_status:r2.status,
          dividend_count:Array.isArray(j2.list)?j2.list.length:0
        });
      }
      if(u.pathname==="/api/dart-dividend-test"){
        const q=new URLSearchParams({
          corp_code:"00126380",
          bsns_year:"2025",
          reprt_code:"11011"
        });
        const r=await fetch(
          `${env.DART_RELAY_URL}/dividend?${q.toString()}`,
          {headers:{"x-kpark-relay-secret":env.KPARK_RELAY_SECRET}}
        );
        return J({
          ok:r.ok,
          status:r.status,
          body:await r.json()
        });
      }
      if(u.pathname==="/api/d1-fundamentals-test"){
      return J(await getD1Fundamentals(
        env,
        u.searchParams.get("ticker") || "005930"
      ));
    }

    if(u.pathname==="/api/dart-test"){ return J(await getDARTFundamentals(env,u.searchParams.get("ticker")||"005930")); }
    if(u.pathname==="/api/dart-history"){
      const ticker=u.searchParams.get("ticker")||"005930";
      const rawCount=Number(u.searchParams.get("count")||5);
      const count=Number.isFinite(rawCount)
        ? Math.max(1,Math.min(5,Math.trunc(rawCount)))
        : 5;
      return J(await getDARTFinancialHistory(env,ticker,count));
    }

    if(u.pathname==="/api/dart-annual-reports"){
      const ticker=u.searchParams.get("ticker")||"005930";
      const beginDate=u.searchParams.get("begin_date")||"20240101";
      const endDate=u.searchParams.get("end_date")||"20261231";
      return J(await getDARTAnnualReportDates(env,ticker,beginDate,endDate));
    }
   if(u.pathname==="/api/nhplug-test"){ return J(await getNhplugRelayQuote(env,u.searchParams.get("ticker")||"005930")); }
      const m=u.pathname.match(/^\/api\/analyze\/([A-Za-z0-9]{6})$/);
   if(m){
     return J(await analyzeTicker(m[1],env));
   }
    if(u.pathname==="/api/krx-kosdaq-test"){ const d=u.searchParams.get("basDd")||"20260825"; const r=await fetch("https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd?basDd="+d,{headers:{"AUTH_KEY":env.KRX_API_KEY,"Accept":"application/json"}}); return new Response(await r.text(),{status:r.status,headers:{"content-type":"application/json;charset=UTF-8"}}); }
    if(u.pathname==="/api/price-sync"){
      const basDd=u.searchParams.get("basDd");
      return J(await syncPriceDay(env,basDd));
    }
    if(u.pathname==="/api/krx-test"){ return J(await getKRXQuote(env,u.searchParams.get("ticker") || u.searchParams.get("basDd"))); }

   if(u.pathname==="/api/top10"){
     return J({
       ok:false,
       reason:"TOP10 live ranking is not enabled in K-PARK 3.0"
     },501);
   }

   return env.ASSETS ? env.ASSETS.fetch(req) : new Response("K-PARK 3.0");
  }catch(e){
   return J({ok:false,error:e.message},500);
  }
 }
};


async function syncPriceDay(env, basDd){
  if(!env.DB) return {ok:false,reason:"D1_NOT_BOUND"};

  const date=String(basDd||"").replace(/-/g,"");
  if(!/^\d{8}$/.test(date)){
    return {ok:false,reason:"INVALID_DATE"};
  }

  const krx=await getKRXQuote(env,date);

  if(!krx?.ok){
    return {ok:false,reason:krx?.reason||"KRX_FETCH_FAILED"};
  }

  const rows=krx?.data?.OutBlock_1||[];

  if(!rows.length){
    return {
      ok:true,
      date,
      fetched:0,
      saved:0,
      reason:"NO_TRADING_DATA"
    };
  }

  let saved=0;

  for(let i=0;i<rows.length;i+=100){
    const chunk=rows.slice(i,i+100);
    const statements=[];

    for(const row of chunk){
      const ticker=String(row.ISU_CD||"").trim().padStart(6,"0");
      const close=Number(row.TDD_CLSPRC||0);

      if(!/^[0-9A-Z]{6}$/.test(ticker) || !(close>0)) continue;

      statements.push(
        env.DB.prepare(`
          INSERT INTO prices(
            ticker,date,open,high,low,close,volume,source
          )
          VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(ticker,date) DO UPDATE SET
            open=excluded.open,
            high=excluded.high,
            low=excluded.low,
            close=excluded.close,
            volume=excluded.volume,
            source=excluded.source
        `).bind(
          ticker,
          date,
          Number(row.TDD_OPNPRC||0),
          Number(row.TDD_HGPRC||0),
          Number(row.TDD_LWPRC||0),
          close,
          Number(row.ACC_TRDVOL||0),
          "KRX"
        )
      );
    }

    if(statements.length){
      await env.DB.batch(statements);
      saved+=statements.length;
    }
  }

  return {
    ok:true,
    date,
    fetched:rows.length,
    saved
  };
}


async function getNhplugDirectToken(env) {
  if (!env.NHPLUG_APP_KEY || !env.NHPLUG_APP_SECRET) {
    return { ok:false, reason:"NHPLUG direct credentials missing" };
  }

  const now = Math.floor(Date.now() / 1000);

  if (nhplugMemoryToken && nhplugMemoryExpiresAt > now + 60) {
    return {
      ok:true,
      token:nhplugMemoryToken,
      mode:"memory"
    };
  }

  try {
    if (env.NHPLUG_TOKEN_KV) {
      const kv = await env.NHPLUG_TOKEN_KV.get("nhplug_token", "json");

      if (kv?.access_token && Number(kv.expires_at) > now + 60) {
        nhplugMemoryToken=String(kv.access_token);
        nhplugMemoryExpiresAt=Number(kv.expires_at);

        return {
          ok:true,
          token:nhplugMemoryToken,
          mode:"kv"
        };
      }
    }
  } catch (_) {}

  try {
    if (env.DB) {
      const row = await env.DB.prepare(
        "SELECT access_token, expires_at FROM nhplug_token_cache WHERE id = ? LIMIT 1"
      ).bind("default").first();

      if (row?.access_token && Number(row.expires_at) > now + 60) {
        nhplugMemoryToken=String(row.access_token);
        nhplugMemoryExpiresAt=Number(row.expires_at);

        return {
          ok:true,
          token:nhplugMemoryToken,
          mode:"cache"
        };
      }
    }
  } catch (_) {}

  try {
    const authUrl = new URL("https://api.nhplug.com:8443/oauth2/token");
    authUrl.searchParams.set("appkey", env.NHPLUG_APP_KEY);
    authUrl.searchParams.set("appsecretkey", env.NHPLUG_APP_SECRET);
    authUrl.searchParams.set("grant_type", "client_credentials");
    authUrl.searchParams.set("scope", "oob");

    const r = await fetch(authUrl.toString(), {
      method:"POST",
      headers:{
        "content-type":"application/x-www-form-urlencoded"
      }
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data.access_token) {
      return {
        ok:false,
        reason:data.rsp_msg || data.message || `NHPLUG token HTTP ${r.status}`
      };
    }

    const expiresIn = Number(data.expires_in || 86400);
    const expiresAt = now + expiresIn;

    try {
      if (env.DB) {
        await env.DB.prepare(
          `INSERT INTO nhplug_token_cache
           (id, access_token, expires_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             access_token=excluded.access_token,
             expires_at=excluded.expires_at,
             updated_at=excluded.updated_at`
        ).bind(
          "default",
          String(data.access_token),
          expiresAt,
          now
        ).run();
      }
    } catch (_) {}

    nhplugMemoryToken=String(data.access_token);
    nhplugMemoryExpiresAt=expiresAt;

    return {
      ok:true,
      token:nhplugMemoryToken,
      mode:"fresh"
    };

  } catch (e) {
    return {
      ok:false,
      reason:e?.message || String(e)
    };
  }
}

async function getNhplugDirectQuote(env, ticker) {
  const auth = await getNhplugDirectToken(env);

  if (!auth.ok) {
    return {
      ok:false,
      reason:auth.reason
    };
  }

  try {
    const r = await fetch(
      "https://api.nhplug.com:8443/krstock/quote/v1/currentPrice",
      {
        method:"POST",
        headers:{
          "x-client-id":env.NHPLUG_APP_KEY,
          "x-client-secret":env.NHPLUG_APP_SECRET,
          "authorization":`Bearer ${auth.token}`,
          "content-type":"application/json; charset=UTF-8"
        },
        body:JSON.stringify({
          Input_0:{
            iem_cd:String(ticker),
            market_cd:"KRX"
          }
        })
      }
    );

    const data = await r.json().catch(() => ({}));

    if (!r.ok || String(data.rsp_cd) !== "00000") {
      return {
        ok:false,
        reason:data.rsp_msg || `NHPLUG quote HTTP ${r.status}`
      };
    }

    const d = data.Output_0 || {};

    const price = Number(d.stck_prpr || 0);
    const change = Number(d.prdy_vrss || 0);
    const previousClose = price - change;
    const calculatedChangeRate =
      previousClose > 0
        ? Math.round((change / previousClose) * 10000) / 100
        : Number(d.move_rate || 0);

    return {
      ok:true,
      data:{
        ticker:d.iem_cd || ticker,
        name:d.iem_nm || ticker,
        price,
        gongprice:Number(d.gongprice || 0) || null,
        change,
        change_rate:calculatedChangeRate,
        open:Number(d.stck_oprc || 0),
        high:Number(d.stck_hgpr || 0),
        low:Number(d.stck_lwpr || 0),
        volume:Number(d.acml_vol || 0),
        source:"NHPLUG",
        source_mode:"direct",
        token_mode:auth.mode
      }
    };

  } catch (e) {
    return {
      ok:false,
      reason:e?.message || String(e)
    };
  }
}

async function getNhplugQuote(env, ticker) {
  const relay = await getNhplugRelayQuote(env, ticker);

  if (relay.ok) {
    return relay;
  }

  const direct = await getNhplugDirectQuote(env, ticker);

  if (direct.ok) {
    return direct;
  }

  return {
    ok:false,
    reason:`relay: ${relay.reason || "failed"} / direct: ${direct.reason || "failed"}`
  };
}

async function getNhplugRelayQuote(env, ticker) {
  if (!env.NHPLUG_RELAY_URL || !env.KPARK_RELAY_SECRET) {
    return { ok: false, reason: "NHPLUG relay config missing" };
  }

  try {
    const url =
      env.NHPLUG_RELAY_URL.replace(/\/$/, "") +
      "/quote?code=" +
      encodeURIComponent(ticker);

    const r = await fetch(url, {
      headers: {
        "x-kpark-relay-secret": env.KPARK_RELAY_SECRET
      }
    });

    const data = await r.json();

    if (!r.ok || !data.ok) {
      return {
        ok: false,
        reason: data.error || `HTTP ${r.status}`
      };
    }

    return {
      ok: true,
      data: {
        ticker: data.ticker,
        name: data.name,
        price: Number(data.price || 0),
        gongprice: Number(data.gongprice || 0) || null,
        change: Number(data.change || 0),
        change_rate: Number(data.change_rate || 0),
        open: Number(data.open || 0),
        high: Number(data.high || 0),
        low: Number(data.low || 0),
        volume: Number(data.volume || 0),
        source: "NHPLUG"
      }
    };
  } catch (e) {
    return {
      ok: false,
      reason: e?.message || String(e)
    };
  }
}












