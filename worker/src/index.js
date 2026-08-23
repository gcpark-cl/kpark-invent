import {get,all} from "./demo.js";
import {score} from "./engine.js";
import {getKRXQuote} from "./providers/krx.js";
import {getDARTFundamentals} from "./providers/dart.js";

const J=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json;charset=UTF-8","cache-control":"no-store"}});
async function analyze(t,env){
 const d=get(t);
 if(env.APP_MODE==="live"&&env.KRX_API_KEY&&env.DART_API_KEY){
   const [q,f]=await Promise.all([getKRXQuote(env,t),getDARTFundamentals(env,t)]);
   if(q.ok&&f.ok){const x={...d,...q.data,...f.data};return {ticker:t,name:x.name,mode:"live",price:x.price,...score(x)};}
 }
 if(!d)return {ticker:t,mode:"demo",score:0,decision:"실제 데이터 연결 대기"};
 return {ticker:t,name:d.name,mode:"demo",price:d.price,...score(d)};
}
export default {async fetch(req,env){
 const u=new URL(req.url);
 try{
  if(u.pathname==="/api/health")return J({ok:true,service:"K-PARK",mode:env.APP_MODE||"demo"});
  if(u.pathname==="/api/providers")return J({krx_configured:!!env.KRX_API_KEY,dart_configured:!!env.DART_API_KEY,live_enabled:env.APP_MODE==="live"});
  let m=u.pathname.match(/^\/api\/analyze\/(\d{6})$/);
  if(m)return J(await analyze(m[1],env));
  if(u.pathname==="/api/top10"){let a=[];for(const t of all())a.push(await analyze(t,env));a.sort((x,y)=>(y.score||0)-(x.score||0));return J(a);}
  return env.ASSETS?env.ASSETS.fetch(req):new Response("K-PARK");
 }catch(e){return J({ok:false,error:e.message},500);}
}};
