const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
export function score(d){
 const per=d.eps>0?d.price/d.eps:99,pbr=d.bps>0?d.price/d.bps:99;
 const value=(clamp((35-per)/27*100)+clamp((5-pbr)/4.3*100))/2;
 const growth=clamp(((d.growth??0)+10)/30*100);
 const balance=clamp(100-(d.debt_ratio??100)*.5);
 const profitability=clamp((d.roe??0)/25*100);
 const s=clamp(value*.30+growth*.20+balance*.25+profitability*.25);
 const f1=d.eps>0?d.eps*(12+Math.min(8,Math.max(0,(d.growth??0)/2))):0;
 const f2=d.bps>0?d.bps*(.8+Math.min(1.2,Math.max(0,(d.roe??0)/20))):0;
 const fair=(f1+f2)/2,b1=fair*.82,b2=fair*.74,b3=fair*.65;
 let decision="관망";
 if(s>=75&&d.price<=b3)decision="핵심 기회";
 else if(s>=70&&d.price<=b2)decision="2차 매수 검토";
 else if(s>=65&&d.price<=b1)decision="1차 매수 검토";
 else if(s>=60&&d.price<fair)decision="관심";
 else if(s<50)decision="보류";
 return {score:+s.toFixed(1),per:+per.toFixed(2),pbr:+pbr.toFixed(2),
 fair_value:Math.round(fair),buy1:Math.round(b1),buy2:Math.round(b2),buy3:Math.round(b3),
 decision,counter_case:["실적 추정 오류 가능성","업종/시장 급락 가능성","공시·현금흐름 등 데이터 누락 가능성"]};
}
