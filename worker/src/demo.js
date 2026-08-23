const D = {
"005930":{
 name:"삼성전자", market:"KOSPI", sector:"반도체/전자",
 price:72000, eps:6200, bps:65000, roe:7.2, debt_ratio:38,
 revenue_growth:8, profit_growth:10, eps_growth:9,
 operating_margin:12.4, net_margin:10.2,
 operating_cashflow:74000000000000, free_cashflow:41000000000000,
 cash_ratio:31, dividend_yield:2.1, volatility:22
},
"000660":{
 name:"SK하이닉스", market:"KOSPI", sector:"반도체",
 price:210000, eps:18000, bps:115000, roe:11.7, debt_ratio:55,
 revenue_growth:18, profit_growth:28, eps_growth:24,
 operating_margin:19, net_margin:14,
 operating_cashflow:29000000000000, free_cashflow:16000000000000,
 cash_ratio:20, dividend_yield:0.7, volatility:35
},
"035420":{
 name:"NAVER", market:"KOSPI", sector:"인터넷/플랫폼",
 price:160000, eps:7000, bps:90000, roe:22.8, debt_ratio:65,
 revenue_growth:10, profit_growth:13, eps_growth:11,
 operating_margin:16, net_margin:13,
 operating_cashflow:2400000000000, free_cashflow:1500000000000,
 cash_ratio:28, dividend_yield:0.8, volatility:29
},
"005380":{
 name:"현대차", market:"KOSPI", sector:"자동차",
 price:250000, eps:30000, bps:300000, roe:14.5, debt_ratio:72,
 revenue_growth:10, profit_growth:12, eps_growth:11,
 operating_margin:9.5, net_margin:8.1,
 operating_cashflow:17000000000000, free_cashflow:10500000000000,
 cash_ratio:19, dividend_yield:4.2, volatility:24
},
"000270":{
 name:"기아", market:"KOSPI", sector:"자동차",
 price:120000, eps:18000, bps:115000, roe:19.2, debt_ratio:58,
 revenue_growth:10, profit_growth:14, eps_growth:13,
 operating_margin:11.2, net_margin:9.7,
 operating_cashflow:11800000000000, free_cashflow:7400000000000,
 cash_ratio:23, dividend_yield:5.0, volatility:26
},
"105560":{
 name:"KB금융", market:"KOSPI", sector:"금융",
 price:105000, eps:11000, bps:90000, roe:11.8, debt_ratio:85,
 revenue_growth:5, profit_growth:7, eps_growth:6,
 operating_margin:18, net_margin:15,
 operating_cashflow:7600000000000, free_cashflow:5500000000000,
 cash_ratio:12, dividend_yield:3.3, volatility:21
},
"051910":{
 name:"LG화학", market:"KOSPI", sector:"화학/배터리소재",
 price:300000, eps:12000, bps:250000, roe:10.5, debt_ratio:66,
 revenue_growth:6, profit_growth:4, eps_growth:5,
 operating_margin:7.5, net_margin:5.8,
 operating_cashflow:5700000000000, free_cashflow:1800000000000,
 cash_ratio:14, dividend_yield:1.1, volatility:34
},
"006400":{
 name:"삼성SDI", market:"KOSPI", sector:"2차전지",
 price:360000, eps:9000, bps:280000, roe:7.2, debt_ratio:49,
 revenue_growth:4, profit_growth:1, eps_growth:3,
 operating_margin:6.4, net_margin:5.1,
 operating_cashflow:3200000000000, free_cashflow:800000000000,
 cash_ratio:17, dividend_yield:0.4, volatility:38
},
"035720":{
 name:"카카오", market:"KOSPI", sector:"인터넷/플랫폼",
 price:52000, eps:1700, bps:30000, roe:8.5, debt_ratio:61,
 revenue_growth:7, profit_growth:4, eps_growth:5,
 operating_margin:8.0, net_margin:5.9,
 operating_cashflow:1700000000000, free_cashflow:900000000000,
 cash_ratio:22, dividend_yield:0.2, volatility:32
},
"068270":{
 name:"셀트리온", market:"KOSPI", sector:"바이오",
 price:190000, eps:6500, bps:105000, roe:9.8, debt_ratio:42,
 revenue_growth:12, profit_growth:16, eps_growth:14,
 operating_margin:29, net_margin:21,
 operating_cashflow:1800000000000, free_cashflow:1100000000000,
 cash_ratio:26, dividend_yield:0.5, volatility:31
}
};

export function getDemo(ticker) {
  const d = D[ticker];
  return d ? { ticker, ...d } : null;
}

export function allDemoTickers() {
  return Object.keys(D);
}
