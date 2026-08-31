import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen

HOST = "127.0.0.1"
PORT = 8790

def load_env(path=".env"):
    data = {}
    if not os.path.exists(path):
        return data
    with open(path, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    return data

ENV = load_env()
DART_API_KEY = os.environ.get("DART_API_KEY", ENV.get("DART_API_KEY", "")).strip()
RELAY_SECRET = os.environ.get("KPARK_RELAY_SECRET", ENV.get("KPARK_RELAY_SECRET", "")).strip()

class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)

        if u.path == "/health":
            self.send_json(200, {
                "ok": True,
                "service": "kpark-dart-relay",
                "dart_key": bool(DART_API_KEY)
            })
            return

        if u.path not in ("/financials", "/dividend", "/company"):
            self.send_json(404, {"ok": False, "error": "Not Found"})
            return

        received = self.headers.get("x-kpark-relay-secret", "")
        if not RELAY_SECRET or received != RELAY_SECRET:
            self.send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        q = parse_qs(u.query)
        corp_code = q.get("corp_code", [""])[0].strip()
        bsns_year = q.get("bsns_year", [""])[0].strip()
        fs_div = q.get("fs_div", ["CFS"])[0].strip()
        reprt_code = q.get("reprt_code", ["11011"])[0].strip()

        if not DART_API_KEY:
            self.send_json(500, {"ok": False, "error": "DART_API_KEY missing"})
            return

        if not corp_code:
            self.send_json(400, {"ok": False, "error": "corp_code required"})
            return

        if u.path != "/company" and not bsns_year:
            self.send_json(400, {"ok": False, "error": "bsns_year required"})
            return

        if u.path == "/company":
            params = urlencode({
                "crtfc_key": DART_API_KEY,
                "corp_code": corp_code
            })
            url = "https://opendart.fss.or.kr/api/company.json?" + params
        elif u.path == "/dividend":
            params = urlencode({
                "crtfc_key": DART_API_KEY,
                "corp_code": corp_code,
                "bsns_year": bsns_year,
                "reprt_code": reprt_code
            })
            url = "https://opendart.fss.or.kr/api/alotMatter.json?" + params
        else:
            params = urlencode({
                "crtfc_key": DART_API_KEY,
                "corp_code": corp_code,
                "bsns_year": bsns_year,
                "reprt_code": reprt_code,
                "fs_div": fs_div
            })
            url = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?" + params

        try:
            req = Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json"
            })
            with urlopen(req, timeout=20) as r:
                raw = r.read()
            data = json.loads(raw.decode("utf-8"))
            self.send_json(200, data)
        except Exception as e:
            self.send_json(500, {"ok": False, "error": str(e)})

    def log_message(self, format, *args):
        return

print(f"K-PARK DART RELAY READY http://{HOST}:{PORT}")
ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
