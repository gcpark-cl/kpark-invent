import http from "node:http";
import { getDARTFundamentals } from "./src/providers/dart.js";

const HOST = "127.0.0.1";
const PORT = 8787;

const env = {
  DART_API_KEY: process.env.DART_API_KEY || "",
  DART_RELAY_URL: process.env.DART_RELAY_URL || "http://127.0.0.1:8790",
  KPARK_RELAY_SECRET: process.env.KPARK_RELAY_SECRET || ""
};

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${HOST}:${PORT}`);

    if (u.pathname === "/health") {
      res.writeHead(200, {"content-type":"application/json; charset=utf-8"});
      return res.end(JSON.stringify({ok:true, mode:"node-bridge"}));
    }

    if (u.pathname === "/api/dart-test") {
      const ticker = String(u.searchParams.get("ticker") || "").trim();
      const result = await getDARTFundamentals(env, ticker);

      res.writeHead(200, {"content-type":"application/json; charset=utf-8"});
      return res.end(JSON.stringify(result));
    }

    res.writeHead(404, {"content-type":"application/json; charset=utf-8"});
    res.end(JSON.stringify({ok:false, reason:"NOT_FOUND"}));
  } catch (e) {
    res.writeHead(500, {"content-type":"application/json; charset=utf-8"});
    res.end(JSON.stringify({ok:false, reason:e?.message || String(e)}));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`K-PARK DART NODE BRIDGE READY http://${HOST}:${PORT}`);
});
