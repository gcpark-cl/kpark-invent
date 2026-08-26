const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
const round=(x,n=1)=>Number(Number(x||0).toFixed(n));

function labelScore(s){
  if(s>=85) return "매우 우수";
  if(s>=75) return "우수";
  if(s>=65) return "양호";
  if(s>=55) return "보통";
  if(s>=45) return "주의";
  return "취약";
}

function valueScore(d, per, pbr){
  const perScore = clamp((30-per)/24*100);
  const pbrScore = clamp((3.5-pbr)/3.0*100);
  const dividendScore = clamp((d.dividend_yield||0)/5*100);
  return clamp(perScore*.45+pbrScore*.40+dividendScore*.15);
}

function growthScore(d){
  return clamp(
    clamp(((Number(d.revenue_growth)||0)+5)/25*100)*.30 +
    clamp(((Number(d.profit_growth)||0)+5)/30*100)*.35 +
    clamp(((Number(d.eps_growth)||0)+5)/30*100)*.35
  );
}

function profitabilityScore(d){
  return clamp(
    clamp((d.roe||0)/20*100)*.45 +
    clamp((d.operating_margin||0)/20*100)*.30 +
    clamp((d.net_margin||0)/15*100)*.25
  );
}

function balanceScore(d){
  const debt = clamp((120-(d.debt_ratio||100))/100*100);
  const cash = clamp((d.cash_ratio||0)/30*100);
  return clamp(debt*.70+cash*.30);
}

function cashflowScore(d){
  const ocf = d.operating_cashflow||0;
  const fcf = d.free_cashflow||0;
  if(ocf<=0) return 20;
  const conversion = clamp((fcf/ocf)*100);
  const positive = fcf>0?100:20;
  return clamp(conversion*.65+positive*.35);
}

function riskScore(d){
  const volRisk = clamp(100-(d.volatility||30)*2);
  const debtRisk = clamp(100-(d.debt_ratio||100)*.45);
  const growthRisk = clamp(50+(d.profit_growth||0)*2);
  return clamp(volRisk*.40+debtRisk*.35+growthRisk*.25);
}

function fairValues(d){
  const growth = Math.max(-10,Math.min(25,d.eps_growth||0));
  const roe = Math.max(0,Math.min(25,d.roe||0));

  const epsBase = d.eps>0 ? d.eps*(11 + Math.max(0,Math.min(10,growth/2))) : 0;
  const bookBase = d.bps>0 ? d.bps*(0.75 + Math.max(0,Math.min(1.25,roe/18))) : 0;
  const base = (epsBase*.58 + bookBase*.42);

  return {
    conservative: Math.round(base*.82),
    base: Math.round(base),
    optimistic: Math.round(base*1.18)
  };
}

function decisionFrom(score, price, f){
  if(score>=80 && price<=f.base*.65) return "핵심 기회";
  if(score>=75 && price<=f.base*.74) return "강한 분할매수 검토";
  if(score>=68 && price<=f.base*.82) return "분할매수 검토";
  if(score>=60 && price<f.base) return "관심";
  if(score<48) return "회피";
  return "관망";
}

function beginnerSummary(d, score, f, decision){
  const gap = f.base>0 ? ((f.base-d.price)/d.price)*100 : 0;
  let valuationText = gap>15 ? "현재 가격은 모델 기준 적정가치보다 낮게 계산됩니다."
    : gap<-10 ? "현재 가격은 모델 기준 적정가치보다 높게 계산됩니다."
    : "현재 가격은 모델 적정가치 부근입니다.";

  return `${d.name}의 K-PARK 종합점수는 ${round(score,0)}점이며 최종 판단은 '${decision}'입니다. ${valuationText} 다만 점수와 적정가치는 모델 추정치이므로 실제 공시와 시장 상황을 함께 확인해야 합니다.`;
}

export function analyzeDetailed(d){
  const per=d.eps>0?d.price/d.eps:99;
  const pbr=d.bps>0?d.price/d.bps:99;

  const factors = {
    value: valueScore(d,per,pbr),
    growth: growthScore(d),
    profitability: profitabilityScore(d),
    balance: balanceScore(d),
    cashflow: cashflowScore(d),
    risk: riskScore(d)
  };

  const score = clamp(
    factors.value*.25 +
    factors.growth*.15 +
    factors.profitability*.20 +
    factors.balance*.15 +
    factors.cashflow*.15 +
    factors.risk*.10
  );

  const fair = fairValues(d);
  const buy1=Math.round(fair.base*.82);
  const buy2=Math.round(fair.base*.74);
  const buy3=Math.round(fair.base*.65);
  const decision=decisionFrom(score,d.price,fair);

  const strengths=[];
  const risks=[];

  if(factors.balance>=70) strengths.push("재무안정성 점수가 양호합니다.");
  if(factors.cashflow>=70) strengths.push("현금흐름이 비교적 안정적입니다.");
  if(factors.profitability>=70) strengths.push("수익성 지표가 우수합니다.");
  if(factors.growth>=70) strengths.push("성장성이 상대적으로 높습니다.");
  if(factors.value>=70) strengths.push("현재 가격의 가치 매력도가 높게 계산됩니다.");

  if(factors.risk<55) risks.push("가격 변동성 또는 재무 위험을 주의해야 합니다.");
  if(factors.growth<50) risks.push("성장 둔화 가능성을 확인해야 합니다.");
  if(factors.cashflow<50) risks.push("현금흐름의 질을 추가로 점검해야 합니다.");
  if(per>25) risks.push("PER 기준으로 밸류에이션 부담이 있을 수 있습니다.");
  if(pbr>2.5) risks.push("PBR 기준으로 자산가치 대비 고평가 가능성이 있습니다.");
  if(!risks.length) risks.push("업종 사이클과 시장 급락 위험은 항상 존재합니다.");
  if(!strengths.length) strengths.push("현재 데이터만으로 압도적인 강점은 확인되지 않습니다.");

  const invalidation=[
    "영업이익 또는 순이익이 2개 분기 연속 큰 폭으로 악화",
    "영업현금흐름이 구조적으로 마이너스로 전환",
    "부채비율이 급격히 상승",
    "주요 공시에서 사업 경쟁력 훼손 요인이 확인",
    "적정가치 계산에 사용한 EPS/BPS가 크게 하향 조정"
  ];

  const factorDetails = [
    {key:"value",name:"가치",score:round(factors.value),grade:labelScore(factors.value),explain:`PER ${round(per,2)}배, PBR ${round(pbr,2)}배, 배당수익률 ${round(d.dividend_yield||0,1)}%를 반영했습니다.`},
    {key:"growth",name:"성장",score:round(factors.growth),grade:labelScore(factors.growth),explain:`매출 성장 ${round(d.revenue_growth)}%, 이익 성장 ${round(d.profit_growth)}%, EPS 성장 ${round(d.eps_growth)}%를 반영했습니다.`},
    {key:"profitability",name:"수익성",score:round(factors.profitability),grade:labelScore(factors.profitability),explain:`ROE ${round(d.roe)}%, 영업이익률 ${round(d.operating_margin)}%, 순이익률 ${round(d.net_margin)}%를 반영했습니다.`},
    {key:"balance",name:"재무안정성",score:round(factors.balance),grade:labelScore(factors.balance),explain:`부채비율 ${round(d.debt_ratio)}%, 현금성 비율 ${round(d.cash_ratio)}%를 반영했습니다.`},
    {key:"cashflow",name:"현금흐름",score:round(factors.cashflow),grade:labelScore(factors.cashflow),explain:`영업현금흐름과 잉여현금흐름(FCF)의 양(+) 여부와 전환율을 반영했습니다.`},
    {key:"risk",name:"위험조정",score:round(factors.risk),grade:labelScore(factors.risk),explain:`가격 변동성, 부채, 이익 성장 안정성을 반영했습니다.`}
  ];

  return {
    score:round(score),
    decision,
    per:round(per,2),
    pbr:round(pbr,2),
    roe:round(d.roe,1),
    eps:d.eps,
    bps:d.bps,
    dividend_yield:round(d.dividend_yield||0,1),
    valuation:{
      conservative:fair.conservative,
      base:fair.base,
      optimistic:fair.optimistic,
      upside_pct:round(((fair.base-d.price)/d.price)*100,1)
    },
    opportunities:{
      buy1,buy2,buy3,
      allocation:[
        {level:"1차",price:buy1,weight:30},
        {level:"2차",price:buy2,weight:30},
        {level:"3차",price:buy3,weight:40}
      ]
    },
    factors:factorDetails,
    financials:{
      revenue_growth:round(d.revenue_growth,1),
      profit_growth:round(d.profit_growth,1),
      eps_growth:round(d.eps_growth,1),
      operating_margin:round(d.operating_margin,1),
      net_margin:round(d.net_margin,1),
      debt_ratio:round(d.debt_ratio,1),
      cash_ratio:round(d.cash_ratio,1),
      operating_cashflow:d.operating_cashflow,
      free_cashflow:d.free_cashflow
    },
    strengths,
    risks,
    counter_case:[
      "현재 이익 성장률이 일시적일 수 있습니다.",
      "업종 사이클 반전으로 밸류에이션이 낮아질 수 있습니다.",
      "시장 급락 시 적정가치와 무관하게 주가가 추가 하락할 수 있습니다.",
      "공시·현금흐름·추정치 데이터가 변경되면 결과도 달라집니다."
    ],
    invalidation,
    beginner_summary:beginnerSummary(d,score,fair,decision)
  };
}
