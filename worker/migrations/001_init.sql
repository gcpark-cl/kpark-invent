CREATE TABLE IF NOT EXISTS securities(ticker TEXT PRIMARY KEY,name TEXT,market TEXT,updated_at TEXT);
CREATE TABLE IF NOT EXISTS prices(ticker TEXT,date TEXT,open REAL,high REAL,low REAL,close REAL,volume INTEGER,source TEXT,PRIMARY KEY(ticker,date));
CREATE TABLE IF NOT EXISTS fundamentals(ticker TEXT,period TEXT,revenue REAL,operating_profit REAL,net_income REAL,eps REAL,bps REAL,debt_ratio REAL,cashflow REAL,roe REAL,source TEXT,PRIMARY KEY(ticker,period));
CREATE TABLE IF NOT EXISTS disclosures(ticker TEXT,report_date TEXT,title TEXT,url TEXT,source TEXT);
CREATE TABLE IF NOT EXISTS analyses(ticker TEXT,analyzed_at TEXT,score REAL,decision TEXT,fair_value REAL,buy1 REAL,buy2 REAL,buy3 REAL,source_mode TEXT);
