import {getDemo, allDemoTickers} from "./demo.js";
import {analyzeDetailed} from "./engine.js";
import {getKRXQuote} from "./providers/krx.js";
import {getDARTFundamentals} from "./providers/dart.js";

const J=(x,s=200)=>new Response(JSON.stringify(x),{
  status:s,
  headers:{
    "content-type":"application/json;charset=UTF-8",
    "cache-control":"no-store"
  }
});

async function analyzeTicker(ticker,env){
  const demo=getDemo(ticker);

  if(env.APP_MODE==="live" && env.KRX_API_KEY && env.DART_API_KEY){
    const [q,f]=await Promise.all([
      getKRXQuote(env,ticker),
      getDARTFundamentals(env,ticker)
    ]);

    if(q.ok && f.ok){
      const merged={...demo,...q.data,...f.data};
      return {
        ticker,
        name:merged.name,
        market:merged.market,
        sector:merged.sector,
        price:merged.price,
        mode:"live",
        version:env.APP_VERSION||"3.0.0",
        ...analyzeDetailed(merged)
      };
    }
  }

  if(!demo){
    return {
      ticker,
      name:"미연결 종목",
      mode:"demo",
      version:env.APP_VERSION||"3.0.0",
      score:0,
      decision:"실데이터 연결 대기",
      message:"현재 DEMO 데이터셋에 없는 종목입니다. KRX/DART 실데이터 연결 후 분석할 수 있습니다."
    };
  }

  return {
    ticker,
    name:`${demo.name} DEMO`,
    market:demo.market,
    sector:demo.sector,
    price:demo.price,
    mode:"demo",
    version:env.APP_VERSION||"3.0.0",
    ...analyzeDetailed(demo)
  };
}

export default {
 async fetch(req,env){
  const u=new URL(req.url);

  try{
   if(u.pathname==="/api/health"){
     return J({ok:true,service:"K-PARK",version:env.APP_VERSION||"3.0.0",mode:env.APP_MODE||"demo"});
   }

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
      if(u.pathname==="/api/dart-test"){ return J(await getDARTFundamentals(env,u.searchParams.get("ticker")||"005930")); }
   const m=u.pathname.match(/^\/api\/analyze\/(\d{6})$/);
   if(m){
     return J(await analyzeTicker(m[1],env));
   }
    if(u.pathname==="/api/krx-test"){ return J(await getKRXQuote(env,u.searchParams.get("basDd"))); }

   if(u.pathname==="/api/top10"){
     const rows=[];
     for(const t of allDemoTickers()){
       rows.push(await analyzeTicker(t,env));
     }
     rows.sort((a,b)=>(b.score||0)-(a.score||0));
     return J(rows.slice(0,10).map(x=>({
       ticker:x.ticker,name:x.name,score:x.score,decision:x.decision,
       price:x.price,mode:x.mode,upside_pct:x.valuation?.upside_pct
     })));
   }

   return env.ASSETS ? env.ASSETS.fetch(req) : new Response("K-PARK 3.0");
  }catch(e){
   return J({ok:false,error:e.message},500);
  }
 }
};
