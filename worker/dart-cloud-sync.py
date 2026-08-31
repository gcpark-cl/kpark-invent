import json
import time
import urllib.request
import concurrent.futures
import subprocess
from pathlib import Path
from datetime import datetime, timezone

market = json.load(
    open(r"src/data/market-master.json", encoding="utf-8-sig")
)

# ?? D1? ??? ?? ??
TICKERS = list(market.keys())

WORKERS = 1
RETRIES = 3
BATCH_SIZE = 100

def sql_value(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def fetch_one(ticker):
    last_error = None

    for attempt in range(1, RETRIES + 1):
        try:
            url = "http://127.0.0.1:8787/api/dart-test?ticker=" + ticker

            with urllib.request.urlopen(url, timeout=45) as r:
                payload = json.loads(r.read().decode("utf-8"))

            d = payload.get("data") or {}

            if not d:
                last_error = payload.get("reason") or "NO_DATA"
                time.sleep(attempt * 1.5)
                continue

            period = str(d.get("dart_year") or "0000")
            updated_at = datetime.now(timezone.utc).isoformat()

            cols = [
                "ticker","period","revenue","operating_profit","net_income",
                "eps","bps","debt_ratio","operating_cashflow","free_cashflow",
                "roe","revenue_growth","profit_growth","eps_growth","source",
                "corp_code","induty_code","sector","dps","equity","cash_ratio",
                "operating_margin","net_margin","dart_year","dart_fs_div",
                "updated_at"
            ]

            vals = [
                ticker, period,
                d.get("revenue"),
                d.get("operating_profit"),
                d.get("net_income"),
                d.get("eps"),
                d.get("bps"),
                d.get("debt_ratio"),
                d.get("operating_cashflow"),
                d.get("free_cashflow"),
                d.get("roe"),
                d.get("revenue_growth"),
                d.get("profit_growth"),
                d.get("eps_growth"),
                "DART",
                d.get("corp_code"),
                d.get("induty_code"),
                d.get("sector"),
                d.get("dps"),
                d.get("equity"),
                d.get("cash_ratio"),
                d.get("operating_margin"),
                d.get("net_margin"),
                d.get("dart_year"),
                d.get("dart_fs_div"),
                updated_at
            ]

            sql = (
                "INSERT OR REPLACE INTO fundamentals ("
                + ",".join(cols)
                + ") VALUES ("
                + ",".join(sql_value(v) for v in vals)
                + ");"
            )

            return ticker, sql, None

        except Exception as e:
            last_error = str(e)
            time.sleep(attempt * 1.5)

    return ticker, None, last_error

def flush_batch(batch, batch_no):
    if not batch:
        return

    path = Path(f"dart-recovery-{batch_no:03d}.sql")
    path.write_text("\n".join(batch), encoding="utf-8")

    last_error = None

    for attempt in range(1, 4):
        try:
            subprocess.run(
                [
                    "npx","wrangler","d1","execute","kpark",
                    "--remote","--yes","--file",str(path)
                ],
                check=True
            )
            path.unlink(missing_ok=True)
            return
        except Exception as e:
            last_error = e
            time.sleep(attempt * 3)

    raise last_error

print("RECOVERY TARGET", len(TICKERS))
print("WORKERS", WORKERS, "RETRIES", RETRIES)

ok = 0
fail = 0
batch = []
batch_no = 1

with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
    for i, (ticker, sql, err) in enumerate(ex.map(fetch_one, TICKERS), 1):

        if sql:
            batch.append(sql)
            ok += 1
        else:
            fail += 1
            print("FAIL", ticker, err)

        if len(batch) >= BATCH_SIZE:
            flush_batch(batch, batch_no)
            print("SAVED", ok, "FAIL", fail, "CHECKED", i)
            batch = []
            batch_no += 1

flush_batch(batch, batch_no)

print("RECOVERY COMPLETE")
print("TARGET", len(TICKERS), "OK", ok, "FAIL", fail)
