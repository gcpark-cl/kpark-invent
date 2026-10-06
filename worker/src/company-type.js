function hasAny(s, items){
  return items.some(x => s.includes(x));
}

export function getCompanyType(name, sector){
  name = String(name || "");
  sector = String(sector || "");

  if(name.includes("\uC2A4\uD329") || name.toUpperCase().includes("SPAC")){
    return "SPAC";
  }

  if([
    "\uC0BC\uC131\uC804\uC790",
    "\uC0BC\uC131\uC804\uC790\uC6B0"
  ].includes(name)){
    return "SEMICONDUCTOR_DEVICE";
  }

  if([
    "\uC6D0\uC775IPS",
    "\uC8FC\uC131\uC5D4\uC9C0\uB2C8\uC5B4\uB9C1"
  ].includes(name)){
    return "SEMICONDUCTOR_EQUIPMENT";
  }

  if(
    name.includes("\uAE08\uC735\uC9C0\uC8FC") ||
    [
      "KB\uAE08\uC735",
      "\uC2E0\uD55C\uC9C0\uC8FC",
      "\uD558\uB098\uAE08\uC735\uC9C0\uC8FC",
      "\uC6B0\uB9AC\uAE08\uC735\uC9C0\uC8FC",
      "BNK\uAE08\uC735\uC9C0\uC8FC",
      "JB\uAE08\uC735\uC9C0\uC8FC",
      "iM\uAE08\uC735\uC9C0\uC8FC",
      "\uBA54\uB9AC\uCE20\uAE08\uC735\uC9C0\uC8FC",
      "\uD55C\uAD6D\uAE08\uC735\uC9C0\uC8FC",
      "\uD55C\uAD6D\uAE08\uC735\uC9C0\uC8FC\uC6B0"
    ].includes(name)
  ){
    return "FINANCIAL_HOLDING";
  }


  if([
    "\uBBF8\uB798\uC5D0\uC14B\uBCA4\uCC98\uD22C\uC790",
    "SV\uC778\uBCA0\uC2A4\uD2B8\uBA3C\uD2B8",
    "\uCEF4\uD37C\uB2C8\uCF00\uC774",
    "\uC2A4\uD1A4\uBE0C\uB9BF\uC9C0\uBCA4\uCC98\uC2A4",
    "HB\uC778\uBCA0\uC2A4\uD2B8\uBA3C\uD2B8",
    "\uCEA1\uC2A4\uD1A4\uD30C\uD2B8\uB108\uC2A4",
    "\uC544\uC8FCIB\uD22C\uC790",
    "\uD050\uCE90\uD53C\uD0C8"
  ].includes(name)){
    return "OTHER_FINANCIAL";
  }

  if([
    "\uBBF8\uC6D0\uD640\uB529\uC2A4",
    "\uCFE0\uCFE0\uD640\uB529\uC2A4",
    "HDC",
    "\uACBD\uB3D9\uC778\uBCA0\uC2A4\uD2B8",
    "\uB3D9\uAD6D\uD640\uB529\uC2A4",
    "\uC624\uB9AC\uC628\uD640\uB529\uC2A4",
    "\uD6A8\uC131",
    "\uD574\uC131\uC0B0\uC5C5",
    "\uD574\uC131\uC0B0\uC5C51\uC6B0"
  ].includes(name)){
    return "HOLDING";
  }

  if(hasAny(sector,[
    "\uAD6D\uB0B4\uC740\uD589",
    "\uC0C1\uD638\uC800\uCD95\uC740\uD589",
    "\uC800\uCD95\uAE30\uAD00"
  ])){
    return "BANK";
  }

  if(sector.includes("\uC99D\uAD8C \uC911\uAC1C\uC5C5")){
    return "SECURITIES";
  }

  if(hasAny(sector,[
    "\uC0DD\uBA85 \uBCF4\uD5D8\uC5C5",
    "\uC190\uD574 \uBCF4\uD5D8\uC5C5",
    "\uC7AC \uBCF4\uD5D8\uC5C5",
    "\uBCF4\uC99D \uBCF4\uD5D8\uC5C5"
  ])){
    return "INSURANCE";
  }

  if(hasAny(sector,[
    "\uC2E0\uC6A9\uCE74\uB4DC \uBC0F \uD560\uBD80\uAE08\uC735\uC5C5",
    "\uAE08\uC735\uB9AC\uC2A4\uC5C5",
    "\uAE30\uD0C0 \uAE08\uC735 \uD22C\uC790\uC5C5"
  ])){
    return "OTHER_FINANCIAL";
  }

  if(sector === "\uC9C0\uC8FC\uD68C\uC0AC"){
    return "HOLDING";
  }

  if(hasAny(sector,[
    "\uC758\uD559 \uBC0F \uC57D\uD559 \uC5F0\uAD6C\uAC1C\uBC1C\uC5C5",
    "\uC790\uC5F0\uACFC\uD559 \uBC0F \uACF5\uD559 \uC5F0\uAD6C\uAC1C\uBC1C\uC5C5"
  ])){
    return "LIFE_SCIENCE_RND";
  }

  if(hasAny(sector,[
    "\uC758\uC57D\uD488",
    "\uC758\uC57D \uBB3C\uC9C8",
    "\uC758\uC57D \uAD00\uB828",
    "\uBC14\uC774\uC624"
  ])){
    return "BIO_PHARMA";
  }

  if(hasAny(sector,[
    "\uBC18\uB3C4\uCCB4 \uC81C\uC870\uC6A9 \uAE30\uACC4",
    "\uBC18\uB3C4\uCCB4 \uBC0F \uB514\uC2A4\uD50C\uB808\uC774 \uC81C\uC870\uC6A9 \uAE30\uACC4",
    "\uB514\uC2A4\uD50C\uB808\uC774 \uC81C\uC870\uC6A9 \uAE30\uACC4 \uC81C\uC870\uC5C5"
  ])){
    return "SEMICONDUCTOR_EQUIPMENT";
  }

  if(hasAny(sector,[
    "\uC804\uC790\uC9D1\uC801\uD68C\uB85C",
    "\uBC18\uB3C4\uCCB4 \uC81C\uC870\uC5C5",
    "\uBC18\uB3C4\uCCB4\uC18C\uC790",
    "\uB2E4\uC774\uC624\uB4DC, \uD2B8\uB79C\uC9C0\uC2A4\uD130"
  ])){
    return "SEMICONDUCTOR_DEVICE";
  }

  if(hasAny(sector,[
    "\uC18C\uD504\uD2B8\uC6E8\uC5B4 \uAC1C\uBC1C \uBC0F \uACF5\uAE09\uC5C5",
    "\uC2DC\uC2A4\uD15C \uC18C\uD504\uD2B8\uC6E8\uC5B4",
    "\uC751\uC6A9 \uC18C\uD504\uD2B8\uC6E8\uC5B4",
    "\uAC8C\uC784 \uC18C\uD504\uD2B8\uC6E8\uC5B4",
    "\uBAA8\uBC14\uC77C \uAC8C\uC784",
    "\uC628\uB77C\uC778 \uAC8C\uC784"
  ])){
    return "SOFTWARE_PRODUCT";
  }

  if(hasAny(sector,[
    "\uCEF4\uD4E8\uD130 \uD504\uB85C\uADF8\uB798\uBC0D",
    "\uCEF4\uD4E8\uD130\uC2DC\uC2A4\uD15C \uD1B5\uD569 \uC790\uBB38 \uBC0F \uAD6C\uCD95 \uC11C\uBE44\uC2A4\uC5C5",
    "\uC2DC\uC2A4\uD15C\uD1B5\uD569",
    "\uB370\uC774\uD130\uBCA0\uC774\uC2A4",
    "\uC628\uB77C\uC778 \uC815\uBCF4",
    "\uC778\uD130\uB137\uC815\uBCF4",
    "\uC790\uB8CC \uCC98\uB9AC, \uD638\uC2A4\uD305"
  ])){
    return "IT_SERVICE";
  }

  if(hasAny(sector,[
    "\uCCA0\uAC15",
    "\uC81C\uCCA0",
    "\uC81C\uAC15",
    "\uC11D\uC720",
    "\uC815\uC81C",
    "\uAE30\uCD08 \uD654\uD559",
    "\uC11D\uC720\uD654\uD559",
    "\uC870\uC120",
    "\uC120\uBC15",
    "\uBE44\uCCA0\uAE08\uC18D",
    "\uC54C\uB8E8\uBBF8\uB284",
    "\uC2DC\uBA58\uD2B8"
  ])){
    return "CYCLICAL";
  }

  if(hasAny(sector,[
    "\uBC29\uC1A1 \uBC0F \uBB34\uC120\uD1B5\uC2E0\uC7A5\uBE44 \uC81C\uC870\uC5C5",
    "\uC720\uC120 \uD1B5\uC2E0\uC7A5\uBE44 \uC81C\uC870\uC5C5",
    "\uC804\uC790 \uBD80\uD488",
    "\uC804\uC790\uBD80\uD488",
    "\uC778\uC1C4\uD68C\uB85C\uAE30\uD310"
  ])){
    return "TECH_HARDWARE";
  }

  if(sector === "\uD1B5\uC2E0 \uBC0F \uBC29\uC1A1\uC7A5\uBE44 \uC81C\uC870\uC5C5"){
    return "TECH_HARDWARE";
  }

  return "GENERAL";
}
