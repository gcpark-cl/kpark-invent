import master from "./data/market-master.json" with { type: "json" };
import sectorMap from "./data/stock-sector-map.json" with { type: "json" };

export function getMarketInfo(ticker){
  const code=String(ticker).padStart(6,"0");
  const base=master[code];
  if(!base) return null;
  return {
    ...base,
    sector:sectorMap[code] || null
  };
}
