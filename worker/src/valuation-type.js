const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const INFRA_ASSET = new Set([
  "088980",
  "094800",
  "415640"
]);

function isReit(name, sector) {
  name = String(name || "");
  sector = String(sector || "");

  const hasReitName = name.includes("\uB9AC\uCE20");

  const sectorOk =
    sector.includes("\uBD80\uB3D9\uC0B0") ||
    sector.includes("\uC2E0\uD0C1\uC5C5") ||
    sector.includes("\uC9D1\uD569\uD22C\uC790\uC5C5") ||
    sector.includes("\uC9D1\uD569 \uD22C\uC790\uC5C5") ||
    sector.includes("\uBE44\uC8FC\uAC70\uC6A9 \uAC74\uBB3C \uC784\uB300\uC5C5");

  return hasReitName && sectorOk;
}

function isGrowthCandidate(d) {
  const revenueGrowth = num(d.revenue_growth);
  const operatingMargin = num(d.operating_margin);
  const roe = num(d.roe);
  const eps = num(d.eps);
  const ocf = num(d.operating_cashflow);

  // Single-period data only:
  // treat as candidate, never confirmed GROWTH.
  if (
    revenueGrowth === null ||
    revenueGrowth < 15 ||
    revenueGrowth > 150
  ) {
    return false;
  }

  return (
    operatingMargin !== null &&
    operatingMargin >= 5 &&
    roe !== null &&
    roe >= 8 &&
    eps !== null &&
    eps > 0 &&
    ocf !== null &&
    ocf > 0
  );
}

export function getValuationType(d, companyType) {
  const ticker = String(d.ticker || "");
  const name = d.name || "";
  const sector = d.sector || "";

  const eps = num(d.eps);
  const roe = num(d.roe);
  const ocf = num(d.operating_cashflow);

  if (isReit(name, sector)) {
    return {
      valuation_type: "REIT_NAV",
      growth_candidate: false,
      reason: "listed_reit"
    };
  }

  if (INFRA_ASSET.has(ticker)) {
    return {
      valuation_type: "INFRA_ASSET",
      growth_candidate: false,
      reason: "special_asset_vehicle"
    };
  }

  if (companyType === "SPAC") {
    return {
      valuation_type: "SPAC",
      growth_candidate: false,
      reason: "spac"
    };
  }

  if (
    companyType === "BANK" ||
    companyType === "SECURITIES" ||
    companyType === "INSURANCE" ||
    companyType === "FINANCIAL_HOLDING" ||
    companyType === "OTHER_FINANCIAL"
  ) {
    return {
      valuation_type: "BOOK_ROE",
      growth_candidate: false,
      reason: "financial_company"
    };
  }

  if (companyType === "HOLDING") {
    return {
      valuation_type: "HOLDING_BOOK",
      growth_candidate: false,
      reason: "holding_company"
    };
  }

  if (companyType === "CYCLICAL") {
    return {
      valuation_type: "CYCLICAL",
      growth_candidate: false,
      reason: "cyclical_company"
    };
  }

  if (
    companyType === "SEMICONDUCTOR_DEVICE" ||
    companyType === "SEMICONDUCTOR_EQUIPMENT"
  ) {
    return {
      valuation_type: "CYCLICAL_TECH",
      growth_candidate: false,
      reason: "semiconductor_cycle"
    };
  }

  if (companyType === "LIFE_SCIENCE_RND") {
    if (
      eps === null || eps <= 0 ||
      roe === null || roe <= 0 ||
      ocf === null || ocf <= 0
    ) {
      return {
        valuation_type: "BIO_SPECIAL",
        growth_candidate: false,
        reason: "rnd_earnings_unsuitable"
      };
    }

    if (isGrowthCandidate(d)) {
      return {
        valuation_type: "GENERAL",
        growth_candidate: true,
        reason: "growth_candidate_single_period"
      };
    }

    return {
      valuation_type: "GENERAL",
      growth_candidate: false,
      reason: "rnd_profitable_general"
    };
  }

  if (companyType === "BIO_PHARMA") {
    return {
      valuation_type: "GENERAL",
      growth_candidate: false,
      reason: "bio_manufacturer"
    };
  }

  if (
    companyType === "SOFTWARE_PRODUCT" ||
    companyType === "IT_SERVICE"
  ) {
    if (isGrowthCandidate(d)) {
      return {
        valuation_type: "GENERAL",
        growth_candidate: true,
        reason: "growth_candidate_single_period"
      };
    }

    return {
      valuation_type: "GENERAL",
      growth_candidate: false,
      reason: "growth_not_confirmed"
    };
  }

  return {
    valuation_type: "GENERAL",
    growth_candidate: false,
    reason: "default"
  };
}
