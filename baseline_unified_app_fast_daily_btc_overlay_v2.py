# baseline_unified_app_fast.py
# Unified Streamlit app with performance upgrades and robust schema migration:
#  - Creates covering & join-friendly indexes (incl. et_time)
#  - Pre-joined minute table (dbo.lab_minute_join) with *stored* columns: ratio, dollar_volume, is_rth (BIT)
#  - Auto-migrates from older computed-column schemas (drops computed is_rth/ratio/dollar_volume if present)
#  - Auto-refreshes the join table for requested symbols/date ranges
#  - Uses SQL joins / pre-joined table to cut Python merges and I/O
#
# Install (Windows, SQL Server / Express):
#   pip install --upgrade streamlit pandas numpy sqlalchemy pyodbc requests tzdata
#
# Run:
#   streamlit run baseline_unified_app_fast.py

import os
import math
import warnings
from datetime import datetime, timedelta, timezone, date, time as dtime
from zoneinfo import ZoneInfo
from typing import Dict, Tuple, List, Optional

import streamlit as st
import pandas as pd
import numpy as np
import requests
import pyodbc

from urllib.parse import quote_plus
from sqlalchemy import create_engine, text


def _sanitize_api_key(k: str) -> str:
    if k is None:
        return ""
    k = k.strip().strip('"').strip("'").strip()
    return k

warnings.filterwarnings("ignore", category=UserWarning, module="pandas.io.sql")
st.set_page_config(page_title="Baseline Lab — FAST", layout="wide")

# ---- Global CSS to ensure full-page scroll & bottom padding ----
SCROLL_CSS = """
<style>
html, body { height: auto !important; }
[data-testid="stAppViewContainer"] { height: auto !important; overflow: auto !important; }
.block-container { height: auto !important; overflow: visible !important; padding-bottom: 8rem !important; }
[data-testid="stSidebar"], [data-testid="stSidebarContent"] { height: auto !important; overflow: auto !important; }
</style>
"""
st.markdown(SCROLL_CSS, unsafe_allow_html=True)

# ---------------- Defaults ----------------
DEFAULT_DB_SERVER = os.environ.get("DB_SERVER", r"LLDT\SQLEXPRESS")
DEFAULT_DB_NAME = os.environ.get("DB_NAME", "streamlit")
DEFAULT_USER_ID = os.environ.get("WORKER_USER_ID", "default")
DEFAULT_SYMBOLS = [
    # Existing miners
    "RIOT","HIVE","BTDR","MARA","CORZ","CLSK","HUT","CAN","CIFR"


]
BASELINE_METHODS = ["VWAP_RATIO", "VOL_WEIGHTED", "WINSORIZED", "WEIGHTED_MEDIAN", "EQUAL_MEAN"]
SIZING_MODES = ["REINVEST (all-in)", "BASE_BUDGET"]

# Timezone
try:
    EASTERN = ZoneInfo("America/New_York")
except Exception:
    try:
        import tzdata  # noqa: F401
        EASTERN = ZoneInfo("America/New_York")
    except Exception:
        EASTERN = None

# ---------------- Help / Field Guides ----------------
HELP_SCHEMA_MD = r"""
### Schema & field reference

**Common columns (both raw tables)**
- `id` — Identity primary key.
- `user_id` — Logical partition tag (from sidebar).
- `ts_utc` — Minute timestamp in UTC (Polygon `t` mapped to seconds).
- `et_date` — Eastern Time (ET) date.
- `et_time` — Eastern Time (ET) time-of-day (HH:MM:SS).
- `et_dow` — Day of week in ET (0=Mon … 6=Sun).
- `o, h, l, c` — Minute **Open**, **High**, **Low**, **Close**.
- `v` — Minute **volume** (stocks: shares; BTC: base units as per Polygon).
- `vw` — Minute **volume-weighted price** (Polygon minute VWAP).
- `n_trades` — Number of prints aggregated in the minute.
- `source` — `'polygon'`.

**Stock-only**
- `symbol` — Ticker (RIOT, HIVE, BTDR, MARA, CORZ, CLSK, HUT, CAN, CIFR).

**Pre-joined table: `dbo.lab_minute_join`**
- `user_id, symbol, ts_utc, et_date, et_time`
- `stock_c, stock_v, btc_c, btc_v`
- **Stored columns (fast to filter/index):**
  - `ratio` = `btc_c / stock_c` (NULL when `stock_c=0`)
  - `dollar_volume` = `stock_c * stock_v`
  - `is_rth` = 1 during **09:30:00–16:00:00 ET**, else 0

Indexes on raw tables are **covering** (include `et_time`) and we add **join-friendly** equality indexes on `(user_id, ts_utc)` (plus `symbol` on stocks).
Indexes on `lab_minute_join` cover typical range scans and session filters; we also attempt a **nonclustered columnstore** for big scans.
"""

HELP_BACKFILL_MD = r"""
### Backfill — how it works

- Pulls **1‑minute aggregates** from Polygon for **BTC (`X:BTCUSD`)** and the **selected symbols**, between your Start/End (ET dates).
- Converts Polygon timestamps (`t` in ms) to UTC (`ts_utc`) and derives **ET date/time**.
- Inserts only **new** minutes (de‑dupes on `user_id`, `symbol`, `ts_utc`).
- Downstream features auto-refresh the pre‑joined table for the exact symbols/date range you run.
"""

# ---------------- Schema (create-if-missing) ----------------
SCHEMA_SQL = r"""
-- Raw tables
IF OBJECT_ID('dbo.lab_price_history','U') IS NULL
BEGIN
  CREATE TABLE dbo.lab_price_history (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id      NVARCHAR(64)  NOT NULL,
    symbol       NVARCHAR(16)  NOT NULL,
    ts_utc       DATETIME2(0)  NOT NULL,
    et_date      DATE          NOT NULL,
    et_time      TIME(0)       NOT NULL,
    et_dow       TINYINT       NOT NULL,
    o            FLOAT         NOT NULL,
    h            FLOAT         NOT NULL,
    l            FLOAT         NOT NULL,
    c            FLOAT         NOT NULL,
    v            BIGINT        NOT NULL,
    vw           FLOAT         NULL,
    n_trades     INT           NULL,
    source       NVARCHAR(24)  NOT NULL DEFAULT 'polygon',
    CONSTRAINT uq_lab_price UNIQUE(user_id, symbol, ts_utc)
  );
END;

IF OBJECT_ID('dbo.lab_btc_history','U') IS NULL
BEGIN
  CREATE TABLE dbo.lab_btc_history (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id      NVARCHAR(64)  NOT NULL,
    ts_utc       DATETIME2(0)  NOT NULL,
    et_date      DATE          NOT NULL,
    et_time      TIME(0)       NOT NULL,
    et_dow       TINYINT       NOT NULL,
    o            FLOAT         NOT NULL,
    h            FLOAT         NOT NULL,
    l            FLOAT         NOT NULL,
    c            FLOAT         NOT NULL,
    v            BIGINT        NOT NULL,
    vw           FLOAT         NULL,
    n_trades     INT           NULL,
    source       NVARCHAR(24)  NOT NULL DEFAULT 'polygon',
    CONSTRAINT uq_lab_btc UNIQUE(user_id, ts_utc)
  );
END;

-- Pre-joined table (stored columns for ratio/dollar_volume/is_rth)
IF OBJECT_ID('dbo.lab_minute_join','U') IS NULL
BEGIN
  CREATE TABLE dbo.lab_minute_join (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    user_id       NVARCHAR(64) NOT NULL,
    symbol        NVARCHAR(16) NOT NULL,
    ts_utc        DATETIME2(0) NOT NULL,
    et_date       DATE         NOT NULL,
    et_time       TIME(0)      NOT NULL,
    stock_c       FLOAT        NOT NULL,
    stock_v       BIGINT       NOT NULL,
    btc_c         FLOAT        NOT NULL,
    btc_v         BIGINT       NOT NULL,
    ratio         FLOAT        NULL,
    dollar_volume FLOAT        NULL,
    is_rth        BIT          NULL,
    CONSTRAINT uq_lab_minute_join UNIQUE (user_id, symbol, ts_utc)
  );
END;
"""

# --- Migration/patch to handle older computed columns and backfill stored fields ---
MIGRATE_SQL = r"""
-- If join table exists, convert computed columns to real columns if needed
IF OBJECT_ID('dbo.lab_minute_join','U') IS NOT NULL
BEGIN
    -- Drop computed 'is_rth' if it exists as computed
    IF EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.lab_minute_join') 
          AND name = 'is_rth' AND is_computed = 1
    )
    BEGIN
        ALTER TABLE dbo.lab_minute_join DROP COLUMN is_rth;
    END;

    -- Ensure 'is_rth' real column exists
    IF COL_LENGTH('dbo.lab_minute_join', 'is_rth') IS NULL
    BEGIN
        ALTER TABLE dbo.lab_minute_join ADD is_rth BIT NULL;
    END;

    -- Drop computed 'ratio' if it exists as computed
    IF EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.lab_minute_join') 
          AND name = 'ratio' AND is_computed = 1
    )
    BEGIN
        ALTER TABLE dbo.lab_minute_join DROP COLUMN ratio;
    END;

    -- Ensure 'ratio' real column exists
    IF COL_LENGTH('dbo.lab_minute_join', 'ratio') IS NULL
    BEGIN
        ALTER TABLE dbo.lab_minute_join ADD ratio FLOAT NULL;
    END;

    -- Drop computed 'dollar_volume' if it exists as computed
    IF EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.lab_minute_join') 
          AND name = 'dollar_volume' AND is_computed = 1
    )
    BEGIN
        ALTER TABLE dbo.lab_minute_join DROP COLUMN dollar_volume;
    END;

    -- Ensure 'dollar_volume' real column exists
    IF COL_LENGTH('dbo.lab_minute_join', 'dollar_volume') IS NULL
    BEGIN
        ALTER TABLE dbo.lab_minute_join ADD dollar_volume FLOAT NULL;
    END;

    -- Backfill NULLs (idempotent)
    UPDATE dbo.lab_minute_join
    SET ratio = CASE WHEN stock_c <> 0 THEN btc_c / stock_c END
    WHERE ratio IS NULL;

    UPDATE dbo.lab_minute_join
    SET dollar_volume = stock_c * stock_v
    WHERE dollar_volume IS NULL;

    UPDATE dbo.lab_minute_join
    SET is_rth = CASE WHEN et_time >= '09:30:00' AND et_time <= '16:00:00' THEN 1 ELSE 0 END
    WHERE is_rth IS NULL;
END;
"""

INDEX_SQL = r"""
-- Raw table covering + join-friendly indexes (drop/recreate with INCLUDE et_time)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lab_price_user_sym_date_ts' AND object_id=OBJECT_ID('dbo.lab_price_history'))
  DROP INDEX IX_lab_price_user_sym_date_ts ON dbo.lab_price_history;
CREATE INDEX IX_lab_price_user_sym_date_ts
ON dbo.lab_price_history (user_id, symbol, et_date, ts_utc)
INCLUDE (c, v, vw, n_trades, et_time);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lab_price_user_sym_ts' AND object_id=OBJECT_ID('dbo.lab_price_history'))
  CREATE INDEX IX_lab_price_user_sym_ts
  ON dbo.lab_price_history (user_id, symbol, ts_utc)
  INCLUDE (et_date, et_time, c, v, vw, n_trades);

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lab_btc_user_date_ts' AND object_id=OBJECT_ID('dbo.lab_btc_history'))
  DROP INDEX IX_lab_btc_user_date_ts ON dbo.lab_btc_history;
CREATE INDEX IX_lab_btc_user_date_ts
ON dbo.lab_btc_history (user_id, et_date, ts_utc)
INCLUDE (c, v, vw, n_trades, et_time);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lab_btc_user_ts' AND object_id=OBJECT_ID('dbo.lab_btc_history'))
  CREATE INDEX IX_lab_btc_user_ts
  ON dbo.lab_btc_history (user_id, ts_utc)
  INCLUDE (et_date, et_time, c, v, vw, n_trades);

-- Pre-joined table indexes (recreate clean to avoid legacy computed-col errors)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lmj_user_sym_date_ts' AND object_id=OBJECT_ID('dbo.lab_minute_join'))
  DROP INDEX IX_lmj_user_sym_date_ts ON dbo.lab_minute_join;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lmj_user_sym_date_sess_ts' AND object_id=OBJECT_ID('dbo.lab_minute_join'))
  DROP INDEX IX_lmj_user_sym_date_sess_ts ON dbo.lab_minute_join;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IXCS_lab_minute_join' AND object_id=OBJECT_ID('dbo.lab_minute_join'))
  DROP INDEX IXCS_lab_minute_join ON dbo.lab_minute_join;

CREATE INDEX IX_lmj_user_sym_date_ts
ON dbo.lab_minute_join (user_id, symbol, et_date, ts_utc)
INCLUDE (et_time, stock_c, stock_v, btc_c, btc_v, ratio, dollar_volume, is_rth);

CREATE INDEX IX_lmj_user_sym_date_sess_ts
ON dbo.lab_minute_join (user_id, symbol, et_date, is_rth, ts_utc)
INCLUDE (et_time, stock_c, stock_v, btc_c, btc_v, ratio, dollar_volume);

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lmj_user_sym_date' AND object_id=OBJECT_ID('dbo.lab_minute_join'))
  DROP INDEX IX_lmj_user_sym_date ON dbo.lab_minute_join;

IF EXISTS (SELECT 1 FROM sys.stats WHERE name='IX_lmj_user_sym_date' AND object_id=OBJECT_ID('dbo.lab_minute_join'))
  DROP STATISTICS dbo.lab_minute_join.IX_lmj_user_sym_date;

CREATE INDEX IX_lmj_user_sym_date
ON dbo.lab_minute_join (user_id, symbol, et_date)
INCLUDE (et_time, stock_c, stock_v, btc_c, btc_v, ratio, dollar_volume, is_rth);


-- Try a columnstore for big scans (ignore if not supported)
BEGIN TRY
  CREATE NONCLUSTERED COLUMNSTORE INDEX IXCS_lab_minute_join
  ON dbo.lab_minute_join (user_id, symbol, et_date, et_time, ts_utc, stock_c, stock_v, btc_c, btc_v, ratio, dollar_volume, is_rth);
END TRY
BEGIN CATCH
  -- ignore
END CATCH;
"""

# ---------------- DB helpers ----------------
def conn_str(server: str, db: str) -> str:
    try:
        drivers = [d for d in pyodbc.drivers()]
    except Exception:
        drivers = []
    if "ODBC Driver 18 for SQL Server" in drivers:
        return (f"DRIVER={{ODBC Driver 18 for SQL Server}};SERVER={server};DATABASE={db};"
                "Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes;")
    elif "ODBC Driver 17 for SQL Server" in drivers:
        return (f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={db};Trusted_Connection=yes;")
    else:
        return (f"DRIVER={{SQL Server}};SERVER={server};DATABASE={db};Trusted_Connection=yes;")

def get_cnx(server: str, db: str):
    return pyodbc.connect(conn_str(server, db))

def pd_read_sql(sql: str, server: str, db: str, params: Optional[object] = None) -> pd.DataFrame:
    if params is not None:
        if isinstance(params, list):
            params = tuple(params)
        elif isinstance(params, np.ndarray):
            params = tuple(params.tolist())
    cn = get_cnx(server, db)
    try:
        return pd.read_sql(sql, cn, params=params)
    finally:
        cn.close()

@st.cache_resource(show_spinner=False)
def get_engine(server: str, database: str, trusted: bool = True, driver: str = None, username: str = None, password: str = None):
    driver = driver or "ODBC Driver 17 for SQL Server"
    if trusted:
        odbc = f"DRIVER={driver};SERVER={server};DATABASE={database};Trusted_Connection=yes;TrustServerCertificate=yes;"
    else:
        odbc = f"DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password};TrustServerCertificate=yes;"
    return create_engine(f"mssql+pyodbc:///?odbc_connect={quote_plus(odbc)}", pool_pre_ping=True, future=True)

def q_df(_engine, sql: str, params: dict = None) -> pd.DataFrame:
    with _engine.connect() as conn:
        return pd.read_sql(text(sql), conn, params=params or {})

def exec_schema_and_indexes(server: str, db: str):
    cn = get_cnx(server, db)
    with cn.cursor() as cur:
        cur.execute(SCHEMA_SQL)
        # Run migration/patch BEFORE index creation
        cur.execute(MIGRATE_SQL)
        cur.execute(INDEX_SQL)
    cn.commit()
    cn.close()

def to_et_parts(ts_utc: datetime):
    if EASTERN is None:
        ts_et = ts_utc
    else:
        ts_et = ts_utc.astimezone(EASTERN)
    return ts_et.date(), dtime(ts_et.hour, ts_et.minute, ts_et.second), ts_et.weekday()

def table_exists(server: str, db: str, schema_name: str, table_name: str) -> bool:
    q = """
    SELECT 1
    FROM sys.objects
    WHERE object_id = OBJECT_ID(:full) AND type = 'U'
    """
    eng = get_engine(server, db, trusted=True)
    df = q_df(eng, q, {"full": f"{schema_name}.{table_name}"})
    return not df.empty

# ---------------- Polygon fetch (paginated) ----------------
def polygon_aggs_iter(ticker: str, start_utc: datetime, end_utc: datetime, api_key: str):
    base_url = (f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/1/minute/"
                f"{int(start_utc.timestamp()*1000)}/{int(end_utc.timestamp()*1000)}")
    url = base_url
    params = {"adjusted": "true", "sort": "asc", "limit": "50000", "apiKey": api_key}
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    while True:
        r = session.get(url, params=params, timeout=60)
        
        try:
            r.raise_for_status()
        except requests.HTTPError as e:
            if r.status_code == 401:
                raise RuntimeError("Polygon 401 Unauthorized — your API key may be missing, quoted, or invalid.") from e
            raise

        j = r.json()
        for row in (j.get("results") or []):
            yield row
        next_url = j.get("next_url")
        cursor = j.get("next") or j.get("next_page_token")
        if next_url:
            url = next_url
            params = {"apiKey": api_key}
        elif cursor:
            url = base_url
            params = {"adjusted": "true", "sort": "asc", "limit": "50000", "apiKey": api_key, "cursor": cursor}
        else:
            break

# ---------------- Inserts with dedupe ----------------
def save_btc_minutes(server: str, db: str, user_id: str, rows: List[dict]) -> int:
    if not rows:
        return 0
    sql = (
        "INSERT INTO dbo.lab_btc_history "
        "(user_id, ts_utc, et_date, et_time, et_dow, o, h, l, c, v, vw, n_trades, source) "
        "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'polygon' "
        "FROM (SELECT 1 AS dummy) AS X "
        "WHERE NOT EXISTS (SELECT 1 FROM dbo.lab_btc_history WHERE user_id=? AND ts_utc=?)"
    )
    cn = get_cnx(server, db)
    ins = []
    for r in rows:
        t_utc = datetime.fromtimestamp(r["t"] / 1000, tz=timezone.utc).replace(microsecond=0)
        et_date, et_time, et_dow = to_et_parts(t_utc)
        ins.append([
            user_id, t_utc, et_date, et_time, et_dow,
            float(r.get("o", 0) or 0), float(r.get("h", 0) or 0),
            float(r.get("l", 0) or 0), float(r.get("c", 0) or 0),
            int(r.get("v", 0) or 0),
            float(r.get("vw")) if r.get("vw") is not None else None,
            int(r.get("n", 0) or 0),
            user_id, t_utc
        ])
    with cn.cursor() as cur:
        cur.fast_executemany = True
        cur.executemany(sql, ins)
    cn.commit()
    cn.close()
    return len(ins)

def save_stock_minutes(server: str, db: str, user_id: str, symbol: str, rows: List[dict]) -> int:
    if not rows:
        return 0
    sql = (
        "INSERT INTO dbo.lab_price_history "
        "(user_id, symbol, ts_utc, et_date, et_time, et_dow, o, h, l, c, v, vw, n_trades, source) "
        "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'polygon' "
        "FROM (SELECT 1 AS dummy) AS X "
        "WHERE NOT EXISTS (SELECT 1 FROM dbo.lab_price_history WHERE user_id=? AND symbol=? AND ts_utc=?)"
    )
    cn = get_cnx(server, db)
    ins = []
    for r in rows:
        t_utc = datetime.fromtimestamp(r["t"] / 1000, tz=timezone.utc).replace(microsecond=0)
        et_date, et_time, et_dow = to_et_parts(t_utc)
        ins.append([
            user_id, symbol, t_utc, et_date, et_time, et_dow,
            float(r.get("o", 0) or 0), float(r.get("h", 0) or 0),
            float(r.get("l", 0) or 0), float(r.get("c", 0) or 0),
            int(r.get("v", 0) or 0),
            float(r.get("vw")) if r.get("vw") is not None else None,
            int(r.get("n", 0) or 0),
            user_id, symbol, t_utc
        ])
    with cn.cursor() as cur:
        cur.fast_executemany = True
        cur.executemany(sql, ins)
    cn.commit()
    cn.close()
    return len(ins)

def backfill_minutes(server: str, db: str, api_key: str, user_id: str,
                     symbols: List[str], start_date: date, end_date: date):
    start_utc = datetime.combine(start_date, dtime.min).replace(tzinfo=EASTERN or timezone.utc).astimezone(timezone.utc)
    end_utc = datetime.combine(end_date, dtime.max).replace(tzinfo=EASTERN or timezone.utc).astimezone(timezone.utc)

    yield ("BTC", "fetching")
    btc_rows = list(polygon_aggs_iter("X:BTCUSD", start_utc, end_utc, api_key))
    yield ("BTC", f"fetched {len(btc_rows):,}")
    saved_btc = save_btc_minutes(server, db, user_id, btc_rows)
    yield ("BTC", f"saved {saved_btc:,}")

    for sym in symbols:
        yield (sym, "fetching")
        sym_rows = list(polygon_aggs_iter(sym, start_utc, end_utc, api_key))
        yield (sym, f"fetched {len(sym_rows):,}")
        saved_s = save_stock_minutes(server, db, user_id, sym, sym_rows)
        yield (sym, f"saved {saved_s:,}")

# ---------------- Join-table refresh & readers ----------------
def refresh_minute_join_for_range(server: str, db: str, user_id: str, symbol: str,
                                  start_date: date, end_date: date) -> int:
    """
    Inserts missing joined minutes for (user_id, symbol, start_date..end_date) into dbo.lab_minute_join.
    Computes and stores ratio, dollar_volume, is_rth at INSERT time.
    Returns the number of rows inserted (best-effort; may be estimate).
    """
    sql = r"""
    INSERT INTO dbo.lab_minute_join
      (user_id, symbol, ts_utc, et_date, et_time, stock_c, stock_v, btc_c, btc_v, ratio, dollar_volume, is_rth)
    SELECT ph.user_id, ph.symbol, ph.ts_utc, ph.et_date, ph.et_time,
           ph.c, ph.v, bh.c, bh.v,
           CASE WHEN ph.c <> 0 THEN bh.c / ph.c END AS ratio,
           (ph.c * ph.v) AS dollar_volume,
           CASE WHEN ph.et_time >= '09:30:00' AND ph.et_time <= '16:00:00' THEN 1 ELSE 0 END AS is_rth
    FROM dbo.lab_price_history ph
    JOIN dbo.lab_btc_history   bh
      ON bh.user_id = ph.user_id AND bh.ts_utc = ph.ts_utc
    WHERE ph.user_id = ? AND ph.symbol = ? AND ph.et_date BETWEEN ? AND ?
      AND NOT EXISTS (
          SELECT 1 FROM dbo.lab_minute_join x
          WHERE x.user_id = ph.user_id AND x.symbol = ph.symbol AND x.ts_utc = ph.ts_utc
      );
    """
    cn = get_cnx(server, db)
    try:
        with cn.cursor() as cur:
            cur.execute(sql, (user_id, symbol, str(start_date), str(end_date)))
        cn.commit()
    finally:
        cn.close()
    return 0

def fetch_join_minutes(server: str, db: str, user_id: str, sym: str,
                       start_date: date, end_date: date) -> pd.DataFrame:
    """
    Prefer the pre-joined table; if missing, fall back to an inline SQL join.
    Ensures lab_minute_join refreshed for the requested range before reading it.
    """
    use_join_table = table_exists(server, db, "dbo", "lab_minute_join")
    if use_join_table:
        # refresh for the requested window (idempotent)
        try:
            refresh_minute_join_for_range(server, db, user_id, sym, start_date, end_date)
        except Exception:
            # Fallback silently if refresh fails; we'll still try to read existing rows.
            pass
        q = r"""
        SELECT ts_utc, et_date, et_time,
               stock_c, stock_v,
               btc_c,   btc_v,
               ratio, dollar_volume, is_rth
        FROM dbo.lab_minute_join
        WHERE user_id = ? AND symbol = ? AND et_date BETWEEN ? AND ?
        ORDER BY ts_utc ASC;
        """
        df = pd_read_sql(q, server, db, params=(user_id, sym, str(start_date), str(end_date)))
        if not df.empty:
            df["et_date"] = pd.to_datetime(df["et_date"]).dt.date
            # ensure et_time as HH:MM:SS string
            df["et_time"] = pd.to_datetime(df["et_time"].astype(str), errors="coerce").dt.time
        return df

    # fallback: inline join
    q = r"""
    SELECT ph.ts_utc, ph.et_date, ph.et_time,
           ph.c AS stock_c, ph.v AS stock_v,
           bh.c AS btc_c,   bh.v AS btc_v
    FROM dbo.lab_price_history ph
    JOIN dbo.lab_btc_history   bh
      ON bh.user_id=ph.user_id AND bh.ts_utc=ph.ts_utc
    WHERE ph.user_id=? AND ph.symbol=? AND ph.et_date BETWEEN ? AND ?
    ORDER BY ph.ts_utc ASC;
    """
    df = pd_read_sql(q, server, db, params=(user_id, sym, str(start_date), str(end_date)))
    if df.empty:
        return df
    df["et_date"] = pd.to_datetime(df["et_date"]).dt.date
    df["et_time"] = pd.to_datetime(df["et_time"].astype(str), errors="coerce").dt.time
    # compute helpers for parity with join table
    df["ratio"] = (df["btc_c"].astype(float) / df["stock_c"].astype(float)).replace([np.inf, -np.inf], np.nan)
    df["dollar_volume"] = df["stock_c"].astype(float) * df["stock_v"].astype(float)
    df["is_rth"] = ((df["et_time"] >= dtime(9,30,0)) & (df["et_time"] <= dtime(16,0,0))).astype(int)
    return df

# ---------------- Window filters ----------------
def filter_window_str(df: pd.DataFrame, window: str = "RTH",
                      cstart: Optional[str] = None, cend: Optional[str] = None) -> pd.DataFrame:
    if df.empty:
        return df
    df = df.copy()
    # Keep original time dtype if available
    if df["et_time"].dtype == "O":
        df["et_time"] = pd.to_datetime(df["et_time"].astype(str), errors="coerce").dt.time
    if window == "RTH":
        return df[(df["et_time"] >= dtime(9,30,0)) & (df["et_time"] <= dtime(16,0,0))]
    elif window == "AH":
        if "is_rth" in df.columns:
            return df[df["is_rth"] != 1]
        return df[(df["et_time"] < dtime(9,30,0)) | (df["et_time"] > dtime(16,0,0))]
    elif window == "CUSTOM" and cstart and cend:
        t0 = datetime.strptime(cstart, "%H:%M:%S").time()
        t1 = datetime.strptime(cend, "%H:%M:%S").time()
        return df[(df["et_time"] >= t0) & (df["et_time"] <= t1)]
    else:
        return df

def filter_window_time(df: pd.DataFrame, window: str, t0: dtime = None, t1: dtime = None) -> pd.DataFrame:
    if df.empty:
        return df
    if window == "RTH":
        return df[(df["et_time"] >= dtime(9, 30, 0)) & (df["et_time"] <= dtime(16, 0, 0))]
    if window == "AH":
        return df[(df["et_time"] < dtime(9, 30, 0)) | (df["et_time"] > dtime(16, 0, 0))]
    if window == "CUSTOM" and t0 and t1:
        return df[(df["et_time"] >= t0) & (df["et_time"] <= t1)]
    return df

def is_rth_time(t: dtime) -> bool:
    return (t >= dtime(9, 30, 0)) and (t <= dtime(16, 0, 0))

def stock_vol_col(df: pd.DataFrame) -> str:
    return "stock_v" if "stock_v" in df.columns else ("v" if "v" in df.columns else "stock_v")

# ---------------- Baseline calculators ----------------
def vwap_ratio(df: pd.DataFrame) -> float:
    btc_v = df.get("btc_v", pd.Series(0, index=df.index)).astype(float).clip(lower=0)
    stk_v = df.get("stock_v", df.get("v", pd.Series(0, index=df.index))).astype(float).clip(lower=0)
    if btc_v.sum() == 0 or stk_v.sum() == 0:
        return float("nan")
    btc_vwap = float((df["btc_c"].astype(float) * btc_v).sum() / btc_v.sum())
    stk_vwap = float((df["stock_c"].astype(float) * stk_v).sum() / stk_v.sum())
    return (btc_vwap / stk_vwap) if stk_vwap > 0 else float("nan")

def vol_weighted_ratio(df: pd.DataFrame, winsor: bool = False,
                       p_low: float = 1.0, p_high: float = 99.0) -> float:
    r = df["btc_c"].astype(float) / df["stock_c"].astype(float).replace(0, np.nan)
    if winsor and r.notna().any():
        lo, hi = np.nanpercentile(r.to_numpy(), [p_low, p_high])
        r = r.clip(lower=lo, upper=hi)
    w = df.get("stock_v", df.get("v")).astype(float).clip(lower=0)
    return float(np.nansum(r * w) / w.sum()) if w.sum() > 0 else float("nan")

def weighted_median_ratio(df: pd.DataFrame) -> float:
    r = (df["btc_c"].astype(float) / df["stock_c"].astype(float).replace(0, np.nan)).to_numpy()
    w = df.get("stock_v", df.get("v")).astype(float).clip(lower=0).to_numpy()
    if r.size == 0 or np.all(np.isnan(r)) or w.sum() == 0:
        return float("nan")
    order = np.argsort(r)
    r = r[order]
    w = w[order]
    cw = np.cumsum(np.nan_to_num(w))
    cutoff = 0.5 * np.nansum(w)
    idx = min(np.searchsorted(cw, cutoff, side="left"), len(r) - 1)
    return float(r[idx])

def equal_mean_ratio(df: pd.DataFrame) -> float:
    r = df["btc_c"].astype(float) / df["stock_c"].astype(float).replace(0, np.nan)
    return float(np.nanmean(r))

def compute_day_method(df_day: pd.DataFrame, method: str) -> float:
    m = method.upper()
    if m == "VWAP_RATIO":
        return vwap_ratio(df_day)
    elif m == "VOL_WEIGHTED":
        return vol_weighted_ratio(df_day, winsor=False)
    elif m == "WINSORIZED":
        return vol_weighted_ratio(df_day, winsor=True)
    elif m == "WEIGHTED_MEDIAN":
        return weighted_median_ratio(df_day)
    else:
        return equal_mean_ratio(df_day)

# ---------------- Previous-N-day helpers (SQL) ----------------
def prev_n_days_for(server: str, db: str, user_id: str, sym: str, ref_date: date, n_prev: int) -> List[date]:
    q = """
    SELECT TOP (?) et_date
    FROM dbo.lab_price_history
    WHERE user_id=? AND symbol=? AND et_date < ?
    GROUP BY et_date
    ORDER BY et_date DESC;
    """
    dfd = pd_read_sql(q, server, db, params=(int(n_prev), user_id, sym, str(ref_date)))
    return [pd.to_datetime(x).date() for x in dfd["et_date"].tolist()] if not dfd.empty else []

# ---------------- Cached baseline map (day -> baseline value) ----------------
@st.cache_data(show_spinner=False)
def compute_daily_baselines(server: str, db: str, user_id: str, sym: str,
                            start_date: date, end_date: date,
                            window: str, cstart: Optional[str], cend: Optional[str],
                            methods: Tuple[str, ...],
                            n_prev: int = 1) -> Dict[Tuple[date, str], float]:
    out: Dict[Tuple[date, str], float] = {}
    if not methods:
        return out
    # Which days exist for symbol in range?
    q_days = """
    SELECT et_date
    FROM dbo.lab_price_history
    WHERE user_id=? AND symbol=? AND et_date BETWEEN ? AND ?
    GROUP BY et_date
    ORDER BY et_date ASC;
    """
    dfd = pd_read_sql(q_days, server, db, params=(user_id, sym, str(start_date), str(end_date)))
    if dfd.empty:
        return out

    # We'll fetch joined minutes day-by-day for baseline windows
    per_day_cache: Dict[Tuple[date, str], float] = {}
    for d in pd.to_datetime(dfd["et_date"]).dt.date:
        prev_days = prev_n_days_for(server, db, user_id, sym, d, n_prev)
        if not prev_days:
            continue
        for m in methods:
            vals = []
            mU = m.upper()
            for pd_ in prev_days:
                key = (pd_, mU)
                if key not in per_day_cache:
                    dfp = fetch_join_minutes(server, db, user_id, sym, pd_, pd_)
                    dfp = filter_window_str(dfp, window, cstart, cend)
                    per_day_cache[key] = compute_day_method(dfp, mU) if not dfp.empty else float("nan")
                v = per_day_cache[key]
                if np.isfinite(v):
                    vals.append(v)
            if len(vals) > 0:
                out[(d, mU)] = float(np.nanmean(vals))
    return out

# ---------------- Surge helper ----------------
def surge_extra_on_base(base_budget: float,
                        ratio_now: float,
                        baseline_ratio: float,
                        buy_pct: float,
                        enable: bool,
                        tier1_mult: float, tier1_bonus_pct: float,
                        tier2_mult: float, tier2_bonus_pct: float,
                        cap_pct: float) -> float:
    if (not enable) or not np.isfinite(baseline_ratio) or baseline_ratio <= 0 or buy_pct <= 0:
        return 0.0
    m = ((ratio_now / baseline_ratio) - 1.0) / (buy_pct / 100.0)
    extra = 0.0
    if m >= tier1_mult:
        extra += base_budget * (tier1_bonus_pct / 100.0)
    if m >= tier2_mult:
        extra += base_budget * (tier2_bonus_pct / 100.0)
    extra_cap = base_budget * (cap_pct / 100.0)
    return min(extra, extra_cap)

# ---------------- Daily curve (no risk gates) ----------------
@st.cache_data(show_spinner=False)
def compute_daily_curve(server: str, db: str, user_id: str, sym: str,
                        start_date: date, end_date: date,
                        window: str, cstart: Optional[str], cend: Optional[str],
                        method: str, buy_pct: float, sell_pct: float,
                        init_cap: float, force_flat_eod: bool,
                        sizing_mode: str,
                        surge_enable: bool,
                        t1_mult: float, t1_bonus: float,
                        t2_mult: float, t2_bonus: float,
                        surge_cap_pct: float,
                        n_prev: int = 1) -> pd.DataFrame:

    df = fetch_join_minutes(server, db, user_id, sym, start_date, end_date)
    df = filter_window_str(df, window, cstart, cend)
    if df.empty:
        return pd.DataFrame(columns=["et_date", "equity_start", "equity_end", "day_return", "cum_return", "trades", "buys", "sells"])

    base_map = compute_daily_baselines(server, db, user_id, sym, start_date, end_date, window, cstart, cend, (method,), n_prev=n_prev)
    et_dates = pd.to_datetime(df["et_date"]).dt.date.to_numpy()
    prices = df["stock_c"].to_numpy(dtype=np.float64)
    btc_px = df["btc_c"].to_numpy(dtype=np.float64)
    ratios = (btc_px / np.maximum(1e-12, prices))
    baseline_minute = np.array([base_map.get((d, method), np.nan) for d in et_dates], dtype=np.float64)

    finite_mask = np.isfinite(baseline_minute)
    buy_trig = (ratios >= baseline_minute * (1.0 + buy_pct / 100.0)) & finite_mask
    sell_trig = (ratios <= baseline_minute * (1.0 - sell_pct / 100.0)) & finite_mask

    records = []
    cash = float(init_cap)
    shares = 0.0
    curr_day = et_dates[0]
    day_equity_start = float(init_cap)
    day_trades = day_buys = day_sells = 0

    def close_day(prev_price: float, day_date):
        nonlocal cash, shares, day_equity_start, day_trades, day_buys, day_sells
        equity_end = cash + shares * prev_price
        day_ret = (equity_end / day_equity_start) - 1.0
        cum_return = (equity_end / float(init_cap)) - 1.0
        records.append({
            "et_date": day_date,
            "equity_start": day_equity_start,
            "equity_end": equity_end,
            "day_return": day_ret,
            "cum_return": cum_return,
            "trades": day_trades,
            "buys": day_buys,
            "sells": day_sells
        })
        if force_flat_eod and shares > 0.0:
            cash += shares * prev_price
            shares = 0.0
        day_equity_start = cash + shares * prev_price
        day_trades = day_buys = day_sells = 0

    for i in range(len(prices)):
        if et_dates[i] != curr_day:
            close_day(prices[i - 1], curr_day)
            curr_day = et_dates[i]

        if not finite_mask[i]:
            continue

        base_target = (cash + shares * prices[i]) if sizing_mode.startswith("REINVEST") else float(init_cap)
        extra = surge_extra_on_base(
            base_budget=float(init_cap),
            ratio_now=float(ratios[i]),
            baseline_ratio=float(baseline_minute[i]),
            buy_pct=float(buy_pct),
            enable=surge_enable,
            tier1_mult=float(t1_mult), tier1_bonus_pct=float(t1_bonus),
            tier2_mult=float(t2_mult), tier2_bonus_pct=float(t2_bonus),
            cap_pct=float(surge_cap_pct)
        )

        if buy_trig[i] and shares <= 0.0:
            target_notional = max(0.0, base_target + (extra if surge_enable else 0.0))
            pos_notional = shares * prices[i]
            to_spend = max(0.0, target_notional - pos_notional)
            if to_spend > 0.0 and cash > 0.0:
                qty = int(math.floor(min(cash, to_spend) / prices[i]))
                if qty > 0:
                    cash -= qty * prices[i]
                    shares += qty
                    day_trades += 1
                    day_buys += 1
        elif sell_trig[i] and shares > 0.0:
            cash += shares * prices[i]
            shares = 0.0
            day_trades += 1
            day_sells += 1

    close_day(prices[-1], curr_day)

    out = pd.DataFrame.from_records(records)
    out["day_return_%"] = (out["day_return"] * 100.0).round(2)
    out["cum_return_%"] = (out["cum_return"] * 100.0).round(2)
    return out

# ---- BTC benchmark helper: aligned to stock trading days ----
def fetch_btc_cum_return_on_days(server: str, db: str, user_id: str,
                                 allowed_dates: list,
                                 window: str, cstart: Optional[str], cend: Optional[str]) -> pd.DataFrame:
    """Return BTC cumulative return only on provided ET dates.
    We take the last minute close within the chosen window for each date in allowed_dates.
    Weekend performance is rolled into Monday automatically by comparing to the previous allowed date.
    """
    if not allowed_dates:
        return pd.DataFrame(columns=["et_date", "BTC"])

    d0 = min(allowed_dates)
    d1 = max(allowed_dates)

    q = r"""
    SELECT ts_utc, et_date, et_time, c
    FROM dbo.lab_btc_history
    WHERE user_id = ? AND et_date BETWEEN ? AND ?
    ORDER BY ts_utc ASC;
    """
    df = pd_read_sql(q, server, db, params=(user_id, str(d0), str(d1)))
    if df.empty:
        return pd.DataFrame(columns=["et_date", "BTC"])

    df["et_date"] = pd.to_datetime(df["et_date"]).dt.date
    df["et_time"] = pd.to_datetime(df["et_time"].astype(str), errors="coerce").dt.time
    df_f = filter_window_str(df.copy(), window, cstart, cend)
    if df_f.empty:
        return pd.DataFrame(columns=["et_date", "BTC"])

    df_f = df_f.sort_values(["et_date", "ts_utc"]).groupby("et_date", as_index=False).last(numeric_only=False)[["et_date", "c"]]

    allowed_sorted = sorted(set(allowed_dates))
    base = pd.DataFrame({"et_date": allowed_sorted})
    last_allowed = base.merge(df_f, on="et_date", how="left").dropna(subset=["c"]).reset_index(drop=True)
    if last_allowed.empty:
        return pd.DataFrame(columns=["et_date", "BTC"])

    # Cumulative return vs first allowed date's close
    first_px = float(last_allowed.loc[0, "c"])
    last_allowed["BTC"] = (last_allowed["c"].astype(float) / max(first_px, 1e-12)) - 1.0
    return last_allowed[["et_date", "BTC"]]

# ---------------- FAST batch components (SQLAlchemy path) ----------------
@st.cache_data(show_spinner=False)
def get_symbols(_engine, user_id: str, version: int = 0) -> list:
    sql = """
    SELECT DISTINCT symbol
    FROM dbo.lab_price_history
    WHERE user_id = :uid
    ORDER BY symbol
    """
    d = q_df(_engine, sql, {"uid": user_id})
    return d["symbol"].tolist()

@st.cache_data(show_spinner=False)
def list_stock_days(_engine, user_id: str, symbol: str, d0: date, d1: date) -> pd.DataFrame:
    sql = """
    SELECT DISTINCT et_date
    FROM dbo.lab_price_history
    WHERE user_id=:uid AND symbol=:sym AND et_date BETWEEN :d0 AND :d1
    ORDER BY et_date
    """
    df = q_df(_engine, sql, {"uid": user_id, "sym": symbol, "d0": str(d0), "d1": str(d1)})
    if not df.empty:
        df["et_date"] = pd.to_datetime(df["et_date"]).dt.date
    return df

def filter_minutes(df: pd.DataFrame, min_shares: int = 0, min_dollar: float = 0.0,
                   price_col="stock_c", vol_col: Optional[str] = None, dollar_col="dollar_volume") -> pd.DataFrame:
    out = df
    vcol = vol_col or stock_vol_col(df)
    if min_shares and min_shares > 0 and vcol in out.columns:
        out = out[out[vcol].astype(float) >= float(min_shares)]
    if min_dollar and min_dollar > 0:
        if dollar_col in out.columns:
            out = out[out[dollar_col].astype(float) >= float(min_dollar)]
        else:
            out = out[(out[price_col].astype(float) * out[vcol].astype(float)) >= float(min_dollar)]
    return out

def baseline_value(prev_df: pd.DataFrame, method: str,
                   winsor_low: float = 0.01, winsor_high: float = 0.99) -> float:
    vcol = stock_vol_col(prev_df)
    df = prev_df.dropna(subset=["stock_c", "btc_c", vcol]).copy()
    if df.empty:
        return np.nan
    ratio = df["btc_c"].astype(float) / df["stock_c"].astype(float)
    vol_w = df[vcol].astype(float).values

    if method == "VWAP_RATIO":
        s_v = df[vcol].sum()
        stock_vwap = (df["stock_c"] * df[vcol]).sum() / s_v if s_v > 0 else df["stock_c"].mean()
        bv = df.get("btc_v", pd.Series([0] * len(df))).sum()
        btc_vwap = (df["btc_c"] * df.get("btc_v", pd.Series([0] * len(df)))).sum() / bv if bv > 0 else df["btc_c"].mean()
        return float(btc_vwap / stock_vwap) if stock_vwap and not math.isclose(stock_vwap, 0.0) else np.nan

    if method == "VOL_WEIGHTED":
        if vol_w.sum() <= 0:
            return float(ratio.mean())
        return float(np.average(ratio.values, weights=vol_w))

    if method == "WINSORIZED":
        lo = np.nanpercentile(ratio.values, winsor_low * 100.0)
        hi = np.nanpercentile(ratio.values, winsor_high * 100.0)
        clipped = ratio.clip(lower=lo, upper=hi).values
        if vol_w.sum() <= 0:
            return float(np.mean(clipped))
        return float(np.average(clipped, weights=vol_w))

    if method == "WEIGHTED_MEDIAN":
        s = np.argsort(ratio.values)
        v = ratio.values[s]
        w = vol_w[s]
        c = np.cumsum(w)
        cutoff = 0.5 * w.sum()
        i = np.searchsorted(c, cutoff)
        return float(v[min(max(i, 0), len(v) - 1)])

    if method == "EQUAL_MEAN":
        return float(ratio.mean())

    return np.nan

# -------------------------
# Fast per-day simulator (single baseline pair) — helper
# -------------------------
def simulate_day_fast(curr_join: pd.DataFrame,
                      base_val: float,
                      buy_pct: float, sell_pct: float,
                      start_capital: float = 1000.0,
                      participation_cap_pct: int = 0,
                      surge_enable: bool = False,
                      t1_mult: float = 2.0, t1_bonus: float = 10.0, t2_mult: float = 3.0, t2_bonus: float = 10.0, surge_cap_pct: float = 50.0,
                      cash: float = None,
                      shares: float = None,
                      base_budget: float = None,
                      export_log: bool = False,
                      symbol: str = "",
                      method: str = "") -> tuple:
    if curr_join.empty or not np.isfinite(base_val):
        if export_log:
            return (start_capital if cash is None else cash, 0.0 if shares is None else shares, 0, [])
        return (start_capital if cash is None else cash, 0.0 if shares is None else shares, 0)

    cap = float(start_capital) if cash is None else float(cash)
    pos = 0.0 if shares is None else float(shares)
    trades = 0
    day_log: List[dict] = [] if export_log else None

    px = curr_join["stock_c"].to_numpy(float, copy=False)
    vcol = stock_vol_col(curr_join)
    vol = curr_join[vcol].to_numpy(float, copy=False)
    R = (curr_join.get("ratio") if "ratio" in curr_join.columns else (curr_join["btc_c"] / curr_join["stock_c"])).to_numpy(float, copy=False)
    dates_vec = curr_join["et_date"].to_numpy()
    times_vec = curr_join["et_time"].to_numpy()

    buy_thr = base_val * (1.0 + buy_pct / 100.0)
    sell_thr = base_val * (1.0 - sell_pct / 100.0)

    if base_budget is None:
        base_budget = float(start_capital)

    for i in range(len(px)):
        p = px[i]
        v = vol[i]
        r = R[i]
        if not np.isfinite(p) or p <= 0 or not np.isfinite(r):
            continue

        if r >= buy_thr and pos <= 0 and cap > 0:
            buy_sh = math.floor(cap / p)
            if participation_cap_pct and participation_cap_pct > 0:
                buy_sh = min(buy_sh, int(v * (participation_cap_pct / 100.0)))
            if buy_sh > 0:
                spend = buy_sh * p
                cap -= spend
                pos = float(buy_sh)
                trades += 1
                if export_log:
                    day_log.append({
                        "symbol": symbol,
                        "et_date": str(dates_vec[i]),
                        "et_time": str(times_vec[i]),
                        "session": "RTH" if is_rth_time(times_vec[i]) else "AH",
                        "action": "BUY",
                        "price": float(p),
                        "ratio": float(r),
                        "base": float(base_val),
                        "shares_traded": int(buy_sh),
                        "buy_pct": float(buy_pct),
                        "sell_pct": float(sell_pct),
                        "method": method
                    })

        elif r <= sell_thr and pos > 0.0:
            cap += pos * p
            if export_log:
                day_log.append({
                    "symbol": symbol,
                    "et_date": str(dates_vec[i]),
                    "et_time": str(times_vec[i]),
                    "session": "RTH" if is_rth_time(times_vec[i]) else "AH",
                    "action": "SELL",
                    "price": float(p),
                    "ratio": float(r),
                    "base": float(base_val),
                    "shares_traded": int(pos),
                    "buy_pct": float(buy_pct),
                    "sell_pct": float(sell_pct),
                    "method": method
                })
            pos = 0.0
            trades += 1

    if export_log:
        return cap, pos, trades, day_log
    return cap, pos, trades

# -------------------------
# Batch (Fast) runner — NO EOD flatten; with optional split thresholds (RTH vs AH)
# -------------------------
def run_grid_for_symbol(server: str, db: str, user_id: str, symbol: str,
                        d0, d1, window, t0, t1,
                        methods, lookback_n,
                        min_shares, min_dollar,
                        apply_to_baseline, apply_to_triggers,
                        participation_cap_pct,
                        buy_list, sell_list,
                        start_capital,
                        surge_enable=False, t1_mult=2.0, t1_bonus=10.0, t2_mult=3.0, t2_bonus=10.0, surge_cap_pct=50.0,
                        progress=None, meta=None,
                        export_trades: bool = False,
                        split_mode: bool = False,
                        buy_list_rth: List[float] = None, sell_list_rth: List[float] = None,
                        buy_list_ah: List[float] = None, sell_list_ah: List[float] = None):
    # Prefetch all joined minutes (includes prev days for baselines)
    # Determine earliest prior trading day needed for baseline
    prev_q = """
    SELECT TOP (?) et_date
    FROM dbo.lab_price_history
    WHERE user_id=? AND symbol=? AND et_date < ?
    GROUP BY et_date
    ORDER BY et_date DESC
    """
    prev_df = pd_read_sql(prev_q, server, db, params=(int(lookback_n), user_id, symbol, str(d0)))
    if not prev_df.empty:
        load_start = min(pd.to_datetime(prev_df["et_date"]).dt.date.tolist())
    else:
        load_start = d0

    df_all = fetch_join_minutes(server, db, user_id, symbol, load_start, d1)

    days_df = list_stock_days(get_engine(server, db), user_id, symbol, d0, d1)
    test_days = days_df["et_date"].tolist() if not days_df.empty else []

    if meta:
        meta(symbol, len(df_all), len(df_all), len(test_days))
    if df_all.empty or not test_days:
        return (pd.DataFrame([]), pd.DataFrame([])) if export_trades else pd.DataFrame([])

    # Window filters
    if window == "RTH":
        df_all = df_all[(df_all["et_time"] >= dtime(9,30,0)) & (df_all["et_time"] <= dtime(16,0,0))]
    elif window == "CUSTOM" and t0 and t1:
        df_all = df_all[(df_all["et_time"] >= t0) & (df_all["et_time"] <= t1)]

    # Split by day across full range
    all_days_sorted = sorted(pd.to_datetime(df_all["et_date"]).dt.date.unique().tolist())
    by_day_all = {d: df_all[pd.to_datetime(df_all["et_date"]).dt.date.eq(d)].copy() for d in all_days_sorted}

    # Precompute current-day joins for triggers (with optional filters)
    curr_join_by_day = {}
    for d in test_days:
        cj = by_day_all.get(d, pd.DataFrame())
        if cj.empty:
            continue
        if apply_to_triggers:
            cj = filter_minutes(cj, min_shares=min_shares, min_dollar=min_dollar)
        if not cj.empty:
            curr_join_by_day[d] = cj

    def prev_days_from_sorted(days_sorted, ref_day, n):
        if ref_day not in days_sorted:
            return []
        idx = days_sorted.index(ref_day)
        lo = max(0, idx - n)
        return days_sorted[lo:idx] if idx - lo >= n else []

    # Baselines
    if not split_mode:
        base_by_day_method = {}
        for method in methods:
            for d in test_days:
                pdays = prev_days_from_sorted(all_days_sorted, d, int(lookback_n))
                if len(pdays) < int(lookback_n):
                    continue
                pj = pd.concat([by_day_all.get(dd, pd.DataFrame()) for dd in pdays], ignore_index=True)
                if pj.empty:
                    continue
                if apply_to_baseline:
                    pj = filter_minutes(pj, min_shares=min_shares, min_dollar=min_dollar)
                base_by_day_method[(d, method)] = baseline_value(pj, method=method) if len(pj) >= 30 else np.nan
    else:
        base_by_day_method_sess = {}
        for method in methods:
            for d in test_days:
                pdays = prev_days_from_sorted(all_days_sorted, d, int(lookback_n))
                if len(pdays) < int(lookback_n):
                    continue
                pj = pd.concat([by_day_all.get(dd, pd.DataFrame()) for dd in pdays], ignore_index=True)
                if pj.empty:
                    continue
                # Prefer stored is_rth if present
                if "is_rth" in pj.columns:
                    pj_rth = pj[pj["is_rth"] == 1]
                    pj_ah = pj[pj["is_rth"] != 1]
                else:
                    pj_rth = pj[pj["et_time"].apply(is_rth_time)]
                    pj_ah = pj[~pj["et_time"].apply(is_rth_time)]
                if apply_to_baseline:
                    pj_rth = filter_minutes(pj_rth, min_shares=min_shares, min_dollar=min_dollar)
                    pj_ah = filter_minutes(pj_ah, min_shares=min_shares, min_dollar=min_dollar)
                base_by_day_method_sess[(d, method, "RTH")] = baseline_value(pj_rth, method=method) if len(pj_rth) >= 30 else np.nan
                base_by_day_method_sess[(d, method, "AH")] = baseline_value(pj_ah, method=method) if len(pj_ah) >= 30 else np.nan

    # 5) Scan thresholds
    results = []
    trades_logs = []

    if not split_mode:
        for method in methods:
            for b in buy_list:
                for s in sell_list:
                    cash = float(start_capital)
                    shares = 0.0
                    total_trades = 0
                    used_days = 0
                    last_px_seen = np.nan
                    mark_date = None
                    mark_time = None

                    for d in test_days:
                        base_val = base_by_day_method.get((d, method), np.nan)
                        cj = curr_join_by_day.get(d, None)
                        if cj is None or not np.isfinite(base_val):
                            continue
                        sim = simulate_day_fast(
                            curr_join=cj,
                            base_val=base_val,
                            buy_pct=b, sell_pct=s,
                            start_capital=start_capital,
                            participation_cap_pct=participation_cap_pct,
                            surge_enable=False, t1_mult=2.0, t1_bonus=10.0, t2_mult=3.0, t2_bonus=10.0, surge_cap_pct=50.0,
                            cash=cash, shares=shares, base_budget=start_capital,
                            export_log=export_trades, symbol=symbol, method=method
                        )
                        if export_trades:
                            cash, shares, t_day, log_day = sim
                            if log_day:
                                trades_logs.extend(log_day)
                        else:
                            cash, shares, t_day = sim
                        total_trades += t_day
                        used_days += 1
                        if not cj.empty:
                            last_px_seen = float(cj.iloc[-1]["stock_c"])
                            mark_date = cj.iloc[-1]["et_date"]
                            mark_time = cj.iloc[-1]["et_time"]

                    final_equity = cash + (shares * (last_px_seen if np.isfinite(last_px_seen) else 0.0))
                    total_return = (final_equity / start_capital) - 1.0 if used_days > 0 else np.nan
                    results.append({
                        "symbol": symbol,
                        "method": method,
                        "buy_pct": b,
                        "sell_pct": s,
                        "n_trades": total_trades,
                        "days_used": used_days,
                        "ending_shares": int(shares),
                        "final_cash": round(cash, 2),
                        "final_equity": round(final_equity, 2),
                        "total_return": total_return
                    })
                    if export_trades:
                        trades_logs.append({
                            "symbol": symbol,
                            "et_date": str(mark_date) if mark_date is not None else "",
                            "et_time": str(mark_time) if mark_time is not None else "",
                            "session": "MARK",
                            "action": "MARK",
                            "price": float(last_px_seen) if (last_px_seen == last_px_seen) else None,
                            "ratio": None,
                            "base": None,
                            "shares_traded": int(shares),
                            "buy_pct": float(b),
                            "sell_pct": float(s),
                            "method": method,
                            "valuation_policy": "LAST_MINUTE",
                            "final_cash": round(cash, 2),
                            "final_equity": round(final_equity, 2)
                        })
    else:
        for method in methods:
            for b_rth in (buy_list_rth or []):
                for s_rth in (sell_list_rth or []):
                    for b_ah in (buy_list_ah or []):
                        for s_ah in (sell_list_ah or []):
                            cash = float(start_capital)
                            shares = 0.0
                            total_trades = 0
                            used_days = 0
                            last_px_seen = np.nan
                            mark_date = None
                            mark_time = None

                            for d in sorted(curr_join_by_day.keys()):
                                br = np.nan
                                ba = np.nan
                                if (d, method, "RTH") in locals().get('base_by_day_method_sess', {}):
                                    br = base_by_day_method_sess.get((d, method, "RTH"), np.nan)
                                if (d, method, "AH") in locals().get('base_by_day_method_sess', {}):
                                    ba = base_by_day_method_sess.get((d, method, "AH"), np.nan)

                                cj = curr_join_by_day.get(d, None)
                                if cj is None or (not np.isfinite(br) and not np.isfinite(ba)):
                                    continue
                                px = cj["stock_c"].to_numpy(float, copy=False)
                                vcol = stock_vol_col(cj)
                                vol = cj[vcol].to_numpy(float, copy=False)
                                R = (cj.get("ratio") if "ratio" in cj.columns else (cj["btc_c"] / cj["stock_c"])).to_numpy(float, copy=False)
                                tms = cj["et_time"].to_numpy()
                                sess_col = cj["is_rth"].to_numpy() if "is_rth" in cj.columns else np.array([1 if is_rth_time(x) else 0 for x in tms])

                                for i in range(len(px)):
                                    p = px[i]
                                    v = vol[i]
                                    r = R[i]
                                    sess_rth = (sess_col[i] == 1)
                                    if not np.isfinite(p) or p <= 0 or not np.isfinite(r):
                                        continue
                                    if sess_rth:
                                        base = br
                                        buy_thr = base * (1.0 + b_rth / 100.0) if np.isfinite(base) else np.nan
                                        sell_thr = base * (1.0 - s_rth / 100.0) if np.isfinite(base) else np.nan
                                        cap_lim = participation_cap_pct
                                    else:
                                        base = ba
                                        buy_thr = base * (1.0 + b_ah / 100.0) if np.isfinite(base) else np.nan
                                        sell_thr = base * (1.0 - s_ah / 100.0) if np.isfinite(base) else np.nan
                                        cap_lim = participation_cap_pct

                                    if not np.isfinite(base):
                                        continue

                                    if r >= buy_thr and shares <= 0.0 and cash > 0.0:
                                        qty = math.floor(cash / p)
                                        if cap_lim and cap_lim > 0:
                                            qty = min(qty, int(v * (cap_lim / 100.0)))
                                        if qty > 0:
                                            cash -= qty * p
                                            shares += qty
                                            total_trades += 1
                                    elif r <= sell_thr and shares > 0.0:
                                        qty = int(shares)
                                        cash += qty * p
                                        shares = 0.0
                                        total_trades += 1
                                used_days += 1
                                if not cj.empty:
                                    last_px_seen = float(cj.iloc[-1]["stock_c"])
                                    mark_date = cj.iloc[-1]["et_date"]
                                    mark_time = cj.iloc[-1]["et_time"]

                            final_equity = cash + (shares * (last_px_seen if np.isfinite(last_px_seen) else 0.0))
                            total_return = (final_equity / start_capital) - 1.0 if used_days > 0 else np.nan
                            results.append({
                                "symbol": symbol,
                                "method": method,
                                "buy_pct_rth": b_rth,
                                "sell_pct_rth": s_rth,
                                "buy_pct_ah": b_ah,
                                "sell_pct_ah": s_ah,
                                "n_trades": total_trades,
                                "days_used": used_days,
                                "ending_shares": int(shares),
                                "final_cash": round(cash, 2),
                                "final_equity": round(final_equity, 2),
                                "total_return": total_return
                            })

                            if export_trades:
                                results_mark = {
                                    "symbol": symbol,
                                    "et_date": str(mark_date) if mark_date is not None else "",
                                    "et_time": str(mark_time) if mark_time is not None else "",
                                    "session": "MARK",
                                    "action": "MARK",
                                    "price": float(last_px_seen) if (last_px_seen == last_px_seen) else None,
                                    "ratio": None,
                                    "base": None,
                                    "shares_traded": int(shares),
                                    "buy_pct_rth": float(b_rth),
                                    "sell_pct_rth": float(s_rth),
                                    "buy_pct_ah": float(b_ah),
                                    "sell_pct_ah": float(s_ah),
                                    "method": method,
                                    "valuation_policy": "LAST_MINUTE",
                                    "final_cash": round(cash, 2),
                                    "final_equity": round(final_equity, 2)
                                }
                                trades_logs.append(results_mark)

    res = pd.DataFrame(results)
    if not res.empty:
        sort_cols = ["symbol", "method", "total_return"]
        res = res.sort_values(sort_cols, ascending=[True, True, False]).reset_index(drop=True)

    if export_trades:
        trades_df = pd.DataFrame(trades_logs) if trades_logs else pd.DataFrame(columns=[
            "symbol", "et_date", "et_time", "session", "action", "price", "ratio", "base",
            "shares_traded", "buy_pct", "sell_pct", "method",
            "buy_pct_rth", "sell_pct_rth", "buy_pct_ah", "sell_pct_ah",
            "valuation_policy", "final_cash", "final_equity"
        ])
        return res, trades_df

    return res

# ---------------- Trade Detail helpers ----------------

# ==== Daily (Fast) helpers — per-day leaderboard + confidence ====
from typing import Optional

def _forward_returns(px: np.ndarray, horizon: int) -> np.ndarray:
    if horizon <= 0 or len(px) <= horizon:
        return np.array([])
    base = np.maximum(px[:-horizon], 1e-12)
    return (px[horizon:] - px[:-horizon]) / base

def _weighted_corr(x: np.ndarray, y: np.ndarray, w: Optional[np.ndarray] = None) -> float:
    mask = np.isfinite(x) & np.isfinite(y)
    if w is not None:
        mask &= np.isfinite(w) & (w > 0)
    x = x[mask]; y = y[mask]; w = (w[mask] if w is not None else None)
    n = len(x)
    if n < 3:
        return float("nan")
    if w is None:
        xm, ym = x.mean(), y.mean()
        cov = ((x - xm) * (y - ym)).mean()
        vx = ((x - xm)**2).mean(); vy = ((y - ym)**2).mean()
    else:
        ws = w.sum()
        xm = (w * x).sum() / ws; ym = (w * y).sum() / ws
        cov = (w * (x - xm) * (y - ym)).sum() / ws
        vx = (w * (x - xm)**2).sum() / ws
        vy = (w * (y - ym)**2).sum() / ws
    denom = float(np.sqrt(vx * vy))
    return float(cov / denom) if denom > 0 else float("nan")

def _spearman_r(x: np.ndarray, y: np.ndarray, w: Optional[np.ndarray] = None) -> float:
    rx = pd.Series(x).rank(method="average").to_numpy()
    ry = pd.Series(y).rank(method="average").to_numpy()
    return _weighted_corr(rx, ry, w)

def fisher_confidence(r: float, n: int) -> float:
    if not np.isfinite(r) or n < 5:
        return 0.0
    r = float(np.clip(r, -0.999999, 0.999999))
    z = np.arctanh(r) * np.sqrt(max(n - 3, 1))
    score = 100.0 * (1.0 - np.exp(-abs(z)))  # 0..100
    return float(np.clip(score, 0.0, 100.0))

def day_signal_correlation(cj: pd.DataFrame, base_val: float, horizon: int = 10, use_dollar_weights: bool = True):
    """
    Intraday correlation between (ratio/base - 1) and forward returns.
    Returns: (n_samples, pearson_r, spearman_r, confidence_score)
    """
    if cj.empty or not np.isfinite(base_val):
        return 0, float("nan"), float("nan"), 0.0

    px = cj["stock_c"].to_numpy(float, copy=False)
    ratio = (cj["btc_c"].to_numpy(float, copy=False) / np.maximum(cj["stock_c"].to_numpy(float, copy=False), 1e-12))
    sig = (ratio / float(base_val)) - 1.0

    if len(px) <= horizon:
        return 0, float("nan"), float("nan"), 0.0

    fwd = _forward_returns(px, int(horizon))
    sig = sig[:-int(horizon)]
    w = None
    if use_dollar_weights and "dollar_volume" in cj.columns:
        w = cj["dollar_volume"].to_numpy(float, copy=False)[:-int(horizon)]

    pear = _weighted_corr(sig, fwd, w)
    spear = _spearman_r(sig, fwd, w)
    n = len(sig)
    conf = fisher_confidence(pear, n)
    return n, pear, spear, conf

@st.cache_data(show_spinner=False)
def run_daily_best_for_symbol(server: str, db: str, user_id: str, symbol: str,
                              d0, d1, window, t0, t1,
                              methods, lookback_n,
                              min_shares, min_dollar,
                              apply_to_baseline, apply_to_triggers,
                              participation_cap_pct,
                              buy_list, sell_list,
                              start_capital,
                              corr_horizon: int = 10):
    """
    For each trading day between d0..d1:
      - compute baselines from previous N trading days (per selected method)
      - simulate each (method, buy%, sell%) on that day (isolated day, no carry)
      - pick the best pair by day_return
      - compute confidence metrics for the winning method on that day
    Returns: (daily_rows_df, summary_df)
    """
    # Determine earliest prior trading day needed for baseline
    prev_q = """
    SELECT TOP (?) et_date
    FROM dbo.lab_price_history
    WHERE user_id=? AND symbol=? AND et_date < ?
    GROUP BY et_date
    ORDER BY et_date DESC
    """
    prev_df = pd_read_sql(prev_q, server, db, params=(int(lookback_n), user_id, symbol, str(d0)))
    load_start = min(pd.to_datetime(prev_df["et_date"]).dt.date.tolist()) if not prev_df.empty else d0

    # Fetch joined minutes (uses pre-joined table when available)
    df_all = fetch_join_minutes(server, db, user_id, symbol, load_start, d1)

    # Session filter
    if window == "RTH":
        df_all = df_all[(df_all["et_time"] >= dtime(9,30,0)) & (df_all["et_time"] <= dtime(16,0,0))]
    elif window == "CUSTOM" and t0 and t1:
        df_all = df_all[(df_all["et_time"] >= t0) & (df_all["et_time"] <= t1)]
    elif window == "AH":
        df_all = df_all[(df_all["et_time"] < dtime(9,30,0)) | (df_all["et_time"] > dtime(16,0,0))]

    if df_all.empty:
        return pd.DataFrame([]), pd.DataFrame([])

    # Days
    all_days = sorted(pd.to_datetime(df_all["et_date"]).dt.date.unique().tolist())
    by_day = {d: df_all[pd.to_datetime(df_all["et_date"]).dt.date.eq(d)].copy() for d in all_days}

    # Liquidity filter helpers (match Batch flags)
    def filt(df):
        return filter_minutes(df, min_shares=min_shares, min_dollar=min_dollar) if apply_to_triggers else df

    # Baselines from previous N trading days
    base_by_day_method = {}
    for method in methods:
        for d in all_days:
            idx = all_days.index(d)
            prev_days = all_days[max(0, idx - int(lookback_n)):idx]
            if len(prev_days) < int(lookback_n):
                continue
            pj = pd.concat([by_day.get(dd, pd.DataFrame()) for dd in prev_days], ignore_index=True)
            if pj.empty:
                continue
            if apply_to_baseline:
                pj = filter_minutes(pj, min_shares=min_shares, min_dollar=min_dollar)
            base_by_day_method[(d, method)] = baseline_value(pj, method=method) if len(pj) >= 30 else float("nan")

    # Grid per day
    daily_rows = []
    for d in all_days:
        cj = by_day.get(d, pd.DataFrame())
        if cj.empty:
            continue
        cj_trig = filt(cj) if apply_to_triggers else cj
        last_px = float(cj_trig.iloc[-1]["stock_c"]) if not cj_trig.empty else float("nan")

        day_best = None
        for method in methods:
            base_val = base_by_day_method.get((d, method), float("nan"))
            if not np.isfinite(base_val) or cj_trig.empty:
                continue
            for b in buy_list:
                for s in sell_list:
                    cash, shares, ntr = simulate_day_fast(
                        curr_join=cj_trig, base_val=base_val,
                        buy_pct=b, sell_pct=s, start_capital=float(start_capital),
                        participation_cap_pct=int(participation_cap_pct),
                        surge_enable=False, cash=float(start_capital), shares=0.0, base_budget=float(start_capital),
                        export_log=False, symbol=symbol, method=method
                    )
                    equity = cash + shares * (last_px if np.isfinite(last_px) else 0.0)
                    day_ret = (equity / float(start_capital)) - 1.0
                    row = (method, b, s, ntr, day_ret, base_val)
                    if (day_best is None) or (day_ret > day_best[4]):
                        day_best = row

        if day_best is None:
            continue

        best_method, best_b, best_s, best_trades, best_ret, base_val = day_best
        n, pear, spear, conf = day_signal_correlation(cj_trig, base_val, horizon=int(corr_horizon))

        daily_rows.append({
            "et_date": d,
            "symbol": symbol,
            "method": best_method,
            "buy_pct": float(best_b),
            "sell_pct": float(best_s),
            "n_trades": int(best_trades),
            "day_return": float(best_ret),
            "day_return_%": round(100.0 * best_ret, 2),
            "baseline": float(base_val),
            "n_minutes": int(n),
            "corr_pearson": float(pear) if np.isfinite(pear) else None,
            "corr_spearman": float(spear) if np.isfinite(spear) else None,
            "confidence": float(conf)
        })

    daily_df = pd.DataFrame(daily_rows)
    if daily_df.empty:
        return pd.DataFrame([]), pd.DataFrame([])

    summary = (daily_df
        .groupby(["symbol", "method"], as_index=False)
        .agg(days_won=("et_date", "count"),
             avg_day_return=("day_return", "mean"),
             med_day_return=("day_return", "median"),
             avg_confidence=("confidence", "mean"))
        .sort_values(["symbol", "days_won", "avg_day_return"], ascending=[True, False, False])
        .reset_index(drop=True))
    summary["avg_day_return_%"] = (summary["avg_day_return"] * 100.0).round(2)
    summary["med_day_return_%"] = (summary["med_day_return"] * 100.0).round(2)

    return daily_df, summary
# ==== End Daily helpers ====

def ten_minute_excl(i: int, v: np.ndarray, px: np.ndarray) -> Tuple[float, float]:
    n = len(v)
    lo = max(0, i - 5)
    hi = min(n - 1, i + 5)
    shares = float(v[lo:hi + 1].sum() - v[i])
    dollars = float((v[lo:hi + 1] * px[lo:hi + 1]).sum() - v[i] * px[i])
    return shares, dollars

@st.cache_data(show_spinner=False)
def compute_daily_baselines_single(server: str, db: str, user_id: str, sym: str,
                                   start_date: date, end_date: date,
                                   window: str, cstart: Optional[str], cend: Optional[str],
                                   method: str, n_prev: int) -> Dict[date, float]:
    out: Dict[date, float] = {}
    q_days = """
    SELECT et_date
    FROM dbo.lab_price_history
    WHERE user_id = ? AND symbol = ? AND et_date BETWEEN ? AND ?
    GROUP BY et_date
    ORDER BY et_date ASC;
    """
    dfd = pd_read_sql(q_days, server, db, params=(user_id, sym, str(start_date), str(end_date)))
    if dfd.empty:
        return out

    per_day_cache: Dict[Tuple[date, str], float] = {}
    for d in pd.to_datetime(dfd["et_date"]).dt.date:
        prev_days = prev_n_days_for(server, db, user_id, sym, d, n_prev)
        if not prev_days:
            continue
        vals = []
        for pd_ in prev_days:
            key = (pd_, method)
            if key not in per_day_cache:
                dfp = fetch_join_minutes(server, db, user_id, sym, pd_, pd_)
                dfp = filter_window_str(dfp, window, cstart, cend)
                per_day_cache[key] = compute_day_method(dfp, method) if not dfp.empty else float("nan")
            v = per_day_cache[key]
            if np.isfinite(v):
                vals.append(v)
        if vals:
            out[d] = float(np.nanmean(vals))
    return out

def simulate_trade_detail(df_all: pd.DataFrame,
                          method_map: Dict[date, float],
                          symbol: str,
                          buy_pct: float, sell_pct: float,
                          init_cap: float,
                          flatten_eod: bool = False) -> pd.DataFrame:
    if df_all.empty:
        return pd.DataFrame(columns=[
            "symbol", "et_date", "et_time", "action", "price", "ratio", "base",
            "shares_traded", "buy_pct", "sell_pct", "method",
            "day_total_shares", "day_total_value",
            "minute_shares", "minute_value",
            "ten_min_shares", "ten_min_value"
        ])

    et_dates = pd.to_datetime(df_all["et_date"]).dt.date.to_numpy()
    et_times = pd.to_datetime(df_all["et_time"].astype(str), errors="coerce").dt.time.astype(str).to_numpy()
    px = df_all["stock_c"].to_numpy(dtype=np.float64)
    vcol = stock_vol_col(df_all)
    vol = df_all[vcol].to_numpy(dtype=np.float64)
    btc = df_all["btc_c"].to_numpy(dtype=np.float64)
    ratio = (btc / np.maximum(1e-12, px))
    base_vec = np.array([method_map.get(d, np.nan) for d in et_dates], dtype=np.float64)
    finite = np.isfinite(base_vec)

    buy_trig = (ratio >= base_vec * (1.0 + buy_pct / 100.0)) & finite
    sell_trig = (ratio <= base_vec * (1.0 - sell_pct / 100.0)) & finite

    day_total_shares = pd.Series(vol).groupby(et_dates).transform("sum").to_numpy()
    day_total_value = pd.Series(vol * px).groupby(et_dates).transform("sum").to_numpy()

    cash = float(init_cap)
    shares = 0.0
    records = []
    curr_day = et_dates[0]

    for i in range(len(px)):
        if et_dates[i] != curr_day and flatten_eod and shares > 0.0:
            j = i - 1
            if j >= 0:
                ten_sh, ten_val = ten_minute_excl(j, vol, px)
                records.append({
                    "symbol": symbol,
                    "et_date": str(et_dates[j]),
                    "et_time": et_times[j],
                    "action": "SELL",
                    "price": float(px[j]),
                    "ratio": float(ratio[j]),
                    "base": float(base_vec[j]),
                    "shares_traded": int(shares),
                    "buy_pct": float(buy_pct),
                    "sell_pct": float(sell_pct),
                    "method": st.session_state.get("trade_method_name", "METHOD"),
                    "day_total_shares": float(day_total_shares[j]),
                    "day_total_value": float(day_total_value[j]),
                    "minute_shares": float(vol[j]),
                    "minute_value": float(vol[j] * px[j]),
                    "ten_min_shares": float(ten_sh),
                    "ten_min_value": float(ten_val)
                })
                cash += shares * px[j]
                shares = 0.0
            curr_day = et_dates[i]

        if not finite[i]:
            continue

        if buy_trig[i] and shares <= 0.0 and cash > 0.0:
            pos_notional = shares * px[i]
            target = cash + pos_notional
            to_spend = max(0.0, target - pos_notional)
            qty = int(math.floor(min(cash, to_spend) / px[i]))
            if qty > 0:
                ten_sh, ten_val = ten_minute_excl(i, vol, px)
                records.append({
                    "symbol": symbol,
                    "et_date": str(et_dates[i]),
                    "et_time": et_times[i],
                    "action": "BUY",
                    "price": float(px[i]),
                    "ratio": float(ratio[i]),
                    "base": float(base_vec[i]),
                    "shares_traded": int(qty),
                    "buy_pct": float(buy_pct),
                    "sell_pct": float(sell_pct),
                    "method": st.session_state.get("trade_method_name", "METHOD"),
                    "day_total_shares": float(day_total_shares[i]),
                    "day_total_value": float(day_total_value[i]),
                    "minute_shares": float(vol[i]),
                    "minute_value": float(vol[i] * px[i]),
                    "ten_min_shares": float(ten_sh),
                    "ten_min_value": float(ten_val)
                })
                cash -= qty * px[i]
                shares += qty

        elif sell_trig[i] and shares > 0.0:
            qty = int(shares)
            if qty > 0:
                ten_sh, ten_val = ten_minute_excl(i, vol, px)
                records.append({
                    "symbol": symbol,
                    "et_date": str(et_dates[i]),
                    "et_time": et_times[i],
                    "action": "SELL",
                    "price": float(px[i]),
                    "ratio": float(ratio[i]),
                    "base": float(base_vec[i]),
                    "shares_traded": int(qty),
                    "buy_pct": float(buy_pct),
                    "sell_pct": float(sell_pct),
                    "method": st.session_state.get("trade_method_name", "METHOD"),
                    "day_total_shares": float(day_total_shares[i]),
                    "day_total_value": float(day_total_value[i]),
                    "minute_shares": float(vol[i]),
                    "minute_value": float(vol[i] * px[i]),
                    "ten_min_shares": float(ten_sh),
                    "ten_min_value": float(ten_val)
                })
                cash += shares * px[i]
                shares = 0.0

    cols = ["symbol", "et_date", "et_time", "action", "price", "ratio", "base",
            "shares_traded", "buy_pct", "sell_pct", "method",
            "day_total_shares", "day_total_value",
            "minute_shares", "minute_value",
            "ten_min_shares", "ten_min_value"]
    return pd.DataFrame.from_records(records, columns=cols)

# ---------------- Sidebar (one config) ----------------
with st.sidebar:
    st.header("Connection & Config")
    server = st.text_input("SQL Server", value=DEFAULT_DB_SERVER, key="svr_main")
    db = st.text_input("Database", value=DEFAULT_DB_NAME, key="db_main")
    user_id = st.text_input("User ID tag", value=DEFAULT_USER_ID, key="uid_main")
    api_key = st.text_input("Polygon API key (for backfill)", type="password", key="pk_main")
    api_key = _sanitize_api_key(api_key)
    odbc_drv = st.text_input("ODBC Driver (for SQLAlchemy fast path)", value="ODBC Driver 17 for SQL Server", key="drv")

    c1, c2, c3 = st.columns([1, 1, 1])
    with c1:
        if st.button("Test DB", key="btn_testdb"):
            try:
                cn = get_cnx(server, db)
                with cn.cursor() as cur:
                    cur.execute("SELECT @@SERVERNAME, @@SERVICENAME")
                    name, svc = cur.fetchone()
                cn.close()
                st.success(f"Connected: {name}\\{svc}")
            except Exception as e:
                st.error(f"DB error: {e}")
    with c2:
        if st.button("Ensure tables/indexes (FAST)", key="btn_schema"):
            try:
                exec_schema_and_indexes(server, db)
                st.success("Tables & indexes ready (raw + pre-joined). If you previously had a computed is_rth/ratio/dollar_volume, it has been migrated.")
            except Exception as e:
                st.error(f"Schema error: {e}")
    with c3:
        if st.button("Clear caches", key="btn_clearcache"):
            try:
                st.cache_data.clear()
                st.cache_resource.clear()
                st.success("Caches cleared.")
            except Exception as e:
                st.error(f"Clear cache error: {e}")

    engine = get_engine(server, db, trusted=True, driver=odbc_drv)

st.title("Baseline Lab — FAST")
st.caption(f"DB: `{server}` • Database: `{db}` • User: `{user_id}`")

# ---------------- Tabs ----------------
tab_bf, tab_base, tab_grid, tab_daily, tab_batch, tab_batch_daily, tab_detail, tab_cov, tab_data = st.tabs(["Backfill", "Baseline", "Threshold Grid", "Daily Curve & ROI", "Batch (Fast)", "Batch (Fast) — Daily", "Trade Detail", "Coverage", "Data"])

# ---- Backfill ----
with tab_bf:
    st.subheader("Backfill minute bars to SQL (BTC + symbols)")
    today = date.today()
    start_d = st.date_input("Start (ET)", value=today - timedelta(days=365), key="bf_start")
    end_d = st.date_input("End (ET)", value=today - timedelta(days=1), key="bf_end")
    all_syms = sorted(set(DEFAULT_SYMBOLS) | set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))))
    syms = st.multiselect("Symbols", all_syms, default=all_syms, key="bf_syms")
    if st.button("Backfill now", key="bf_run"):
        try:
            if not api_key:
                st.error("Polygon API key required.")
                st.stop()
            if start_d > end_d:
                st.error("Start must be ≤ End.")
                st.stop()
            exec_schema_and_indexes(server, db)
            msg = st.empty()
            for sym, status in backfill_minutes(server, db, api_key, user_id, syms, start_d, end_d):
                msg.info(f"{sym}: {status}")
            msg.success("Backfill complete.")
            st.session_state["sym_ver"] = st.session_state.get("sym_ver", 0) + 1
        except Exception as e:
            st.error(f"Backfill error: {e}")

    st.markdown("---")
    st.markdown(HELP_BACKFILL_MD)

# ---- Baseline sanity ----
with tab_base:
    st.subheader("Previous-day baseline (sanity check) — supports N-day average")
    all_syms = sorted(set(DEFAULT_SYMBOLS) | set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))))
    sym = st.selectbox("Symbol", all_syms,
                       index=(DEFAULT_SYMBOLS.index("CIFR") if "CIFR" in DEFAULT_SYMBOLS else 0),
                       key="base_sym")
    method = st.selectbox("Method", BASELINE_METHODS, index=0, key="base_method")
    window = st.selectbox("Window", ["RTH", "CUSTOM", "AH", "ALL"], key="base_window")
    n_prev = st.number_input("Prev trading days to average (N)", min_value=1, value=1, step=1, key="base_nprev")
    ref_d = st.date_input("Reference date (ET)", value=date.today(), key="base_refdate")
    cstart = st.text_input("Custom start", "09:30:00", key="base_cstart")
    cend = st.text_input("Custom end", "16:00:00", key="base_cend")
    if st.button("Compute baseline", key="base_btn"):
        try:
            base = np.nan
            days = prev_n_days_for(server, db, user_id, sym, ref_d, int(n_prev))
            vals = []
            for d_ in days:
                dfp = fetch_join_minutes(server, db, user_id, sym, d_, d_)
                dfp = filter_window_str(dfp, window, cstart, cend)
                v = compute_day_method(dfp, method) if not dfp.empty else np.nan
                if np.isfinite(v):
                    vals.append(v)
            base = float(np.nanmean(vals)) if vals else np.nan
            if np.isfinite(base):
                st.success(f"{sym} — {method} baseline (avg of last {int(n_prev)} day(s)) = {base:,.6f}")
            else:
                st.warning("No baseline available (missing prior trading days or empty window).")
        except Exception as e:
            st.error(f"Error: {e}")

# ---- Threshold Grid (single symbol) ----
with tab_grid:
    st.subheader("Grid: buy/sell % vs prior‑N‑day baseline (compare multiple methods)")
    left, right = st.columns([2, 1])
    with left:
        all_syms = sorted(set(DEFAULT_SYMBOLS) | set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))))
        sym_g = st.selectbox("Symbol (grid)", all_syms,
                             index=(DEFAULT_SYMBOLS.index("CIFR") if "CIFR" in DEFAULT_SYMBOLS else 0),
                             key="grid_sym")
        methods_g = st.multiselect("Baseline methods", BASELINE_METHODS,
                                   default=["VWAP_RATIO", "WINSORIZED"], key="grid_methods")
        if not methods_g:
            st.info("Select one or more methods to compare.")
        window_g = st.selectbox("Window", ["RTH", "CUSTOM", "AH", "ALL"], key="grid_window")
        n_prev_g = st.number_input("Prev trading days to average (N)", min_value=1, value=1, step=1, key="grid_nprev")
        cstart_g = st.text_input("Custom start", "09:30:00", key="grid_cstart")
        cend_g = st.text_input("Custom end", "16:00:00", key="grid_cend")
        start_bt = st.date_input("Backtest start (ET)", value=date.today() - timedelta(days=30), key="grid_start")
        end_bt = st.date_input("Backtest end (ET)", value=date.today() - timedelta(days=1), key="grid_end")
        colb1, colb2, colb3 = st.columns(3)
        with colb1:
            buy_lo = st.number_input("Buy% min", value=0.5, step=0.1, format="%.1f", key="grid_buy_lo")
            buy_hi = st.number_input("Buy% max", value=2.0, step=0.1, format="%.1f", key="grid_buy_hi")
            buy_st = st.number_input("Buy% step", value=0.5, step=0.1, format="%.1f", key="grid_buy_st")
        with colb2:
            sell_lo = st.number_input("Sell% min", value=1.0, step=0.1, format="%.1f", key="grid_sell_lo")
            sell_hi = st.number_input("Sell% max", value=4.0, step=0.1, format="%.1f", key="grid_sell_hi")
            sell_st = st.number_input("Sell% step", value=0.5, step=0.1, format="%.1f", key="grid_sell_st")
        with colb3:
            init_cap = st.number_input("Initial capital ($)", value=10000.0, step=100.0, format="%.2f", key="grid_init_cap")
        sizing_mode = st.selectbox("Portfolio sizing", SIZING_MODES, index=0, key="grid_sizing")
    with right:
        st.markdown("**Surge (long buys only)**")
        surge_on = st.checkbox("Enable Surge", value=False, key="grid_surge_on")
        t1_mult = st.number_input("Tier‑1 multiple (×)", value=2.0, step=0.1, format="%.1f", key="grid_t1_mult")
        t1_bonus = st.number_input("Tier‑1 bonus % of base", value=10.0, step=1.0, format="%.1f", key="grid_t1_bonus")
        t2_mult = st.number_input("Tier‑2 multiple (×)", value=3.0, step=0.1, format="%.1f", key="grid_t2_mult")
        t2_bonus = st.number_input("Tier‑2 bonus % of base", value=10.0, step=1.0, format="%.1f", key="grid_t2_bonus")
        surge_cap = st.number_input("Surge cap % of base", value=50.0, step=5.0, format="%.1f", key="grid_cap")

    if st.button("Run grid", key="grid_run"):
        try:
            if start_bt >= end_bt:
                st.error("Start must be earlier than End.")
                st.stop()
            if not methods_g:
                st.error("Choose at least one method.")
                st.stop()
            if buy_st <= 0 or sell_st <= 0:
                st.error("Step must be > 0.")
                st.stop()
            if buy_lo > buy_hi or sell_lo > sell_hi:
                st.error("Min must be ≤ Max.")
                st.stop()

            df_all = fetch_join_minutes(server, db, user_id, sym_g, start_bt, end_bt)
            df_all = filter_window_str(df_all, window_g, cstart_g, cend_g)
            if df_all.empty:
                st.warning("No joined minutes in this range/window.")
                st.stop()

            base_map = compute_daily_baselines(
                server, db, user_id, sym_g, start_bt, end_bt, window_g, cstart_g, cend_g,
                tuple(methods_g), n_prev=int(n_prev_g)
            )
            et_dates = pd.to_datetime(df_all["et_date"]).dt.date.to_numpy()
            prices = df_all["stock_c"].to_numpy(dtype=np.float64)
            btc_px = df_all["btc_c"].to_numpy(dtype=np.float64)
            ratios = (btc_px / np.maximum(1e-12, prices))

            buy_vals = [round(x, 4) for x in np.arange(buy_lo, buy_hi + 1e-9, buy_st)]
            sell_vals = [round(x, 4) for x in np.arange(sell_lo, sell_hi + 1e-9, sell_st)]

            rows = []
            total_runs = len(methods_g) * len(buy_vals) * len(sell_vals)
            prog = st.progress(0.0, text="Running grid…")
            run_idx = 0

            for m in methods_g:
                mU = m.upper()
                baseline_minute = np.array([base_map.get((d, mU), np.nan) for d in et_dates], dtype=np.float64)
                finite_mask = np.isfinite(baseline_minute)

                for b in buy_vals:
                    for s in sell_vals:
                        allow_mask = finite_mask
                        buy_trig = (ratios >= baseline_minute * (1.0 + b / 100.0)) & allow_mask
                        sell_trig = (ratios <= baseline_minute * (1.0 - s / 100.0)) & allow_mask

                        cash = float(init_cap)
                        shares = 0.0
                        ntr = 0

                        for i in range(len(prices)):
                            base_target = (cash + shares * prices[i]) if SIZING_MODES[0].startswith("REINVEST") else float(init_cap)
                            extra = surge_extra_on_base(
                                base_budget=float(init_cap),
                                ratio_now=float(ratios[i]),
                                baseline_ratio=float(baseline_minute[i]),
                                buy_pct=float(b),
                                enable=surge_on,
                                tier1_mult=float(t1_mult), tier1_bonus_pct=float(t1_bonus),
                                tier2_mult=float(t2_mult), tier2_bonus_pct=float(t2_bonus),
                                cap_pct=float(surge_cap)
                            )

                            if buy_trig[i] and shares <= 0.0:
                                target_notional = max(0.0, base_target + (extra if surge_on else 0.0))
                                pos_notional = shares * prices[i]
                                to_spend = max(0.0, target_notional - pos_notional)
                                if to_spend > 0.0 and cash > 0.0:
                                    qty = int(math.floor(min(cash, to_spend) / prices[i]))
                                    if qty > 0:
                                        cash -= qty * prices[i]
                                        shares += qty
                                        ntr += 1
                            elif sell_trig[i] and shares > 0.0:
                                cash += shares * prices[i]
                                shares = 0.0
                                ntr += 1

                        equity = cash + shares * prices[-1]
                        total_return = (equity / float(init_cap)) - 1.0
                        rows.append((mU, f"N={int(n_prev_g)}", b, s, ntr, total_return))

                        run_idx += 1
                        prog.progress(run_idx / total_runs, text=f"Running grid… {run_idx}/{total_runs}")

            res = pd.DataFrame(rows, columns=["method", "baseline_span", "buy_pct", "sell_pct", "n_trades", "total_return"]).sort_values(["method", "total_return"], ascending=[True, False])
            res["total_return_%"] = (res["total_return"] * 100.0).round(2)
            st.dataframe(res, use_container_width=True)
            st.download_button(
                "Download CSV",
                data=res.to_csv(index=False).encode("utf-8"),
                file_name=f"grid_{sym_g}_{start_bt}_{end_bt}_N{int(n_prev_g)}.csv",
                mime="text/csv",
                key="grid_dl"
            )
        except Exception as e:
            st.error(f"Grid error: {e}")


# ---- Daily curve ----
with tab_daily:
    st.subheader("Daily Curve & ROI (long) — multi‑symbol with BTC benchmark aligned to stock trading days")

    # Symbols (multi-select)
    all_syms = sorted(set(DEFAULT_SYMBOLS) | set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))))
    default_sel = all_syms[:3] if len(all_syms) >= 3 else all_syms
    symbols_sel = st.multiselect("Symbols (daily)", all_syms, default=default_sel, key="daily_syms")

    # Common strategy parameters across selected symbols
    method_d = st.selectbox("Baseline (daily)", BASELINE_METHODS, index=0, key="daily_method")
    n_prev_d = st.number_input("Prev trading days to average (N)", min_value=1, value=1, step=1, key="daily_nprev")
    sizing_d = st.selectbox("Portfolio sizing", SIZING_MODES, index=0, key="daily_sizing")

    window_d = st.selectbox("Window", ["RTH", "CUSTOM", "AH", "ALL"], key="daily_window")
    cstart_d = st.text_input("Custom start", "09:30:00", key="daily_cstart")
    cend_d = st.text_input("Custom end", "16:00:00", key="daily_cend")

    start_dy = st.date_input("Start (ET)", value=date.today() - timedelta(days=60), key="daily_start")
    end_dy = st.date_input("End (ET)", value=date.today() - timedelta(days=1), key="daily_end")

    col1, col2, col3 = st.columns(3)
    with col1:
        buy_d = st.number_input("Buy% (daily)", value=1.0, step=0.1, format="%.1f", key="daily_buy")
    with col2:
        sell_d = st.number_input("Sell% (daily)", value=2.0, step=0.1, format="%.1f", key="daily_sell")
    with col3:
        init_d = st.number_input("Initial capital ($)", value=10000.0, step=100.0, format="%.2f", key="daily_init")

    force_flat = st.checkbox("Force flat at end of day", value=False, key="daily_flat")
    include_btc = st.checkbox("Overlay Bitcoin (buy & hold) benchmark", value=True, key="daily_btc_bench")
    align_mode = st.selectbox("Trading day alignment", ["Union (any selected stock)", "Intersection (all selected stocks)"], index=0, key="daily_align")

    if st.button("Run daily curves", key="daily_run_multi"):
        try:
            if start_dy >= end_dy:
                st.error("Start must be earlier than End.")
                st.stop()
            if not symbols_sel:
                st.error("Select at least one symbol.")
                st.stop()

            # Build per-symbol daily curves and collect their date sets
            per_symbol_frames = []
            per_symbol_dates = []
            metrics_rows = []

            for sym_d in symbols_sel:
                df_daily = compute_daily_curve(
                    server, db, user_id, sym_d, start_dy, end_dy,
                    window_d, cstart_d, cend_d,
                    method_d, buy_d, sell_d, init_d, force_flat,
                    sizing_d,
                    False, 2.0, 10.0, 3.0, 10.0, 50.0,
                    n_prev=int(n_prev_d)
                )
                if df_daily.empty:
                    st.warning(f"No results for {sym_d} (missing join or empty range/window).")
                    continue

                # Keep just (date, cum_return) per symbol
                sub = df_daily[["et_date", "cum_return"]].copy()
                sub.rename(columns={"cum_return": sym_d}, inplace=True)
                per_symbol_frames.append(sub)
                per_symbol_dates.append(set(pd.to_datetime(sub["et_date"]).dt.date.tolist()))

                # Metrics
                eq = df_daily["equity_end"].to_numpy(dtype=float)
                running_max = np.maximum.accumulate(eq) if len(eq) else eq
                dd = (eq / np.maximum(1e-12, running_max)) - 1.0 if len(eq) else np.array([])
                metrics_rows.append({
                    "symbol": sym_d,
                    "total_return_%": round(100.0 * float(df_daily.iloc[-1]["cum_return"]), 2),
                    "total_trades": int(df_daily["trades"].sum()),
                    "max_drawdown_%": round(100.0 * (float(dd.min()) if len(dd) else 0.0), 2),
                })

            if not per_symbol_frames:
                st.warning("No curves to display.")
                st.stop()

            # Determine allowed trading dates from selected symbols
            if align_mode.startswith("Union"):
                allowed_dates = sorted(set().union(*per_symbol_dates))
            else:
                allowed_dates = sorted(set.intersection(*per_symbol_dates)) if len(per_symbol_dates) > 1 else sorted(next(iter(per_symbol_dates)))

            # Base dataframe with allowed dates only
            chart = pd.DataFrame({"et_date": allowed_dates})

            # Merge each symbol curve onto the base dates
            for sub in per_symbol_frames:
                chart = chart.merge(sub, on="et_date", how="left")

            # BTC benchmark aligned to allowed dates
            if include_btc:
                btc_df = fetch_btc_cum_return_on_days(server, db, user_id, allowed_dates, window_d, cstart_d, cend_d)
                if not btc_df.empty:
                    chart = chart.merge(btc_df, on="et_date", how="left")
                else:
                    st.info("BTC benchmark unavailable for the selected window/range.")

            # Plot
            if chart.empty:
                st.warning("No curves to display.")
            else:
                chart = chart.sort_values("et_date")
                st.line_chart(chart.set_index("et_date"))

                if metrics_rows:
                    st.subheader("Summary metrics")
                    st.dataframe(pd.DataFrame(metrics_rows), use_container_width=True)

                st.download_button(
                    "Download chart data (CSV)",
                    data=chart.to_csv(index=False).encode("utf-8"),
                    file_name=f"daily_curves_{start_dy}_{end_dy}_{method_d}_N{int(n_prev_d)}.csv",
                    mime="text/csv",
                    key="daily_multi_dl"
                )

        except Exception as e:
            st.error(f"Daily curves error: {e}")
# ---- Batch (Fast) multi‑symbol grid ----
with tab_batch:
    st.subheader("Batch (Fast): multi‑symbol grid — NO EOD flatten; carries wallet across days")
    syms = sorted(set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))) | set(DEFAULT_SYMBOLS))
    symbols = st.multiselect("Symbols", options=syms, default=syms[:9], key="sym_multi")

    c_d = st.columns(2)
    with c_d[0]:
        d0 = st.date_input("Start date", value=date.today() - timedelta(days=30), key="batch_start_date")
    with c_d[1]:
        d1 = st.date_input("End date", value=date.today(), key="batch_end_date")

    window_b = st.selectbox("Window (ET)", ["RTH", "CUSTOM", "AH", "ALL"], index=1, key="batch_window")
    t0 = t1 = None
    if window_b == "CUSTOM":
        cc = st.columns(2)
        with cc[0]:
            t0 = st.time_input("Custom start ET", value=dtime(9, 30, 0), key="batch_ct0")
        with cc[1]:
            t1 = st.time_input("Custom end ET", value=dtime(16, 0, 0), key="batch_ct1")

    methods_b = st.multiselect("Baseline methods", BASELINE_METHODS,
                               default=["WINSORIZED", "VOL_WEIGHTED", "WEIGHTED_MEDIAN", "VWAP_RATIO", "EQUAL_MEAN"],
                               key="batch_methods")
    lookback_n = st.number_input("Use previous N trading days", min_value=1, max_value=5, value=1, step=1, key="batch_lbk")

    st.markdown("**Liquidity filters**")
    lc1, lc2, lc3 = st.columns(3)
    with lc1:
        min_shares = st.number_input("Min shares/min", min_value=0, value=0, step=100, key="batch_min_shares")
    with lc2:
        min_dollar = st.number_input("Min $/min", min_value=0, value=0, step=1000, key="batch_min_dollar")
    with lc3:
        participation_cap_pct = st.number_input("Max % of minute volume", min_value=0, max_value=100, value=0, step=1, key="batch_partcap")
    apply_to_baseline = st.checkbox("Apply filters to baseline days", value=True, key="batch_filt_prev")
    apply_to_triggers = st.checkbox("Apply filters to trigger days", value=True, key="batch_filt_curr")

    split_batch = st.checkbox("Split thresholds (RTH vs After‑Hours)", value=False, key="batch_split")

    st.markdown("**Thresholds**")
    single_pair = st.checkbox("Run single thresholds (ignore ranges)", value=True, key="batch_single_pair")

    def arange_f(a, b, s):
        if a is None:
            return []
        if s is None or s <= 0:
            return [float(a)]
        out = []
        x = float(a)
        while x <= float(b) + 1e-9:
            out.append(round(x, 4))
            x += float(s)
        return out

    if not split_batch:
        c_b = st.columns(3)
        with c_b[0]:
            buy_start = st.number_input("Buy% start", min_value=0.0, max_value=5.0, value=0.5, step=0.1, key="batch_bstart")
        with c_b[1]:
            buy_end = st.number_input("Buy% end", min_value=0.0, max_value=5.0, value=2.0, step=0.1, key="batch_bend", disabled=single_pair)
        with c_b[2]:
            buy_step = st.number_input("Buy% step", min_value=0.1, max_value=1.0, value=0.1, step=0.1, key="batch_bstep", disabled=single_pair)

        c_s = st.columns(3)
        with c_s[0]:
            sell_start = st.number_input("Sell% start", min_value=0.0, max_value=5.0, value=1.0, step=0.1, key="batch_sstart")
        with c_s[1]:
            sell_end = st.number_input("Sell% end", min_value=0.0, max_value=5.0, value=2.0, step=0.1, key="batch_send", disabled=single_pair)
        with c_s[2]:
            sell_step = st.number_input("Sell% step", min_value=0.1, max_value=1.0, value=0.1, step=0.1, key="batch_sstep", disabled=single_pair)
    else:
        st.write("__RTH thresholds__")
        c_r1, c_r2, c_r3 = st.columns(3)
        with c_r1:
            b_rth_start = st.number_input("Buy% start (RTH)", min_value=0.0, max_value=10.0, value=0.5, step=0.1, key="batch_b_rth_s")
        with c_r2:
            b_rth_end = st.number_input("Buy% end (RTH)", min_value=0.0, max_value=10.0, value=2.0, step=0.1, key="batch_b_rth_e", disabled=single_pair)
        with c_r3:
            b_rth_step = st.number_input("Buy% step (RTH)", min_value=0.1, max_value=2.0, value=0.1, step=0.1, key="batch_b_rth_step", disabled=single_pair)
        c_r4, c_r5, c_r6 = st.columns(3)
        with c_r4:
            s_rth_start = st.number_input("Sell% start (RTH)", min_value=0.0, max_value=10.0, value=1.0, step=0.1, key="batch_s_rth_s")
        with c_r5:
            s_rth_end = st.number_input("Sell% end (RTH)", min_value=0.0, max_value=10.0, value=4.0, step=0.1, key="batch_s_rth_e", disabled=single_pair)
        with c_r6:
            s_rth_step = st.number_input("Sell% step (RTH)", min_value=0.1, max_value=2.0, value=0.1, step=0.1, key="batch_s_rth_step", disabled=single_pair)

        st.write("__After‑Hours thresholds__")
        c_a1, c_a2, c_a3 = st.columns(3)
        with c_a1:
            b_ah_start = st.number_input("Buy% start (AH)", min_value=0.0, max_value=10.0, value=0.5, step=0.1, key="batch_b_ah_s")
        with c_a2:
            b_ah_end = st.number_input("Buy% end (AH)", min_value=0.0, max_value=10.0, value=2.0, step=0.1, key="batch_b_ah_e", disabled=single_pair)
        with c_a3:
            b_ah_step = st.number_input("Buy% step (AH)", min_value=0.1, max_value=2.0, value=0.1, step=0.1, key="batch_b_ah_step", disabled=single_pair)
        c_a4, c_a5, c_a6 = st.columns(3)
        with c_a4:
            s_ah_start = st.number_input("Sell% start (AH)", min_value=0.0, max_value=10.0, value=1.0, step=0.1, key="batch_s_ah_s")
        with c_a5:
            s_ah_end = st.number_input("Sell% end (AH)", min_value=0.0, max_value=10.0, value=4.0, step=0.1, key="batch_s_ah_e", disabled=single_pair)
        with c_a6:
            s_ah_step = st.number_input("Sell% step (AH)", min_value=0.1, max_value=2.0, value=0.1, step=0.1, key="batch_s_ah_step", disabled=single_pair)

    start_capital = st.number_input("Start capital ($/symbol)", min_value=100.0, value=10000.0, step=100.0, key="batch_start_cap")

    st.markdown("**Exports & debug**")
    exp_col1, exp_col2 = st.columns([1, 2])
    with exp_col1:
        export_trades = st.checkbox("Export per‑trade log (single pair only)", value=True, key="batch_export_trades")
    with exp_col2:
        if not single_pair and export_trades:
            st.warning("Per‑trade export requires a single threshold pair. Turn on 'Run single thresholds'.")

    run_batch = st.button("Run Batch (selected symbols)", type="primary", key="run_batch_btn")

    meta_placeholder = st.empty()
    prog = st.progress(0, text="Idle.")
    status = st.empty()

    def meta_cb(symbol, all_rows, btc_rows, days):
        meta_placeholder.write(f"**{symbol}** — joined minutes: {all_rows:,}, BTC minutes: {btc_rows:,}, trading days: {days:,}")

    def progress_cb(symbol, step, total, method, b, s, d):
        pct = int(round(100.0 * step / max(1, total)))
        prog.progress(pct, text=f"{symbol}: {step}/{total} • {method} • day={d}")

    if run_batch:
        if not symbols:
            st.error("Select at least one symbol.")
        elif not methods_b:
            st.error("Select at least one baseline method.")
        elif d1 < d0:
            st.error("End date must be on/after start date.")
        elif export_trades and not single_pair:
            st.error("Per‑trade export requires 'Run single thresholds' to be ON.")
        else:
            if not split_batch:
                if single_pair:
                    buy_list = [round(float(st.session_state["batch_bstart"]), 4)]
                    sell_list = [round(float(st.session_state["batch_sstart"]), 4)]
                else:
                    buy_list = arange_f(st.session_state["batch_bstart"], st.session_state["batch_bend"], st.session_state["batch_bstep"])
                    sell_list = arange_f(st.session_state["batch_sstart"], st.session_state["batch_send"], st.session_state["batch_sstep"])
            else:
                if single_pair:
                    buy_list_rth = [round(float(st.session_state["batch_b_rth_s"]), 4)]
                    sell_list_rth = [round(float(st.session_state["batch_s_rth_s"]), 4)]
                    buy_list_ah = [round(float(st.session_state["batch_b_ah_s"]), 4)]
                    sell_list_ah = [round(float(st.session_state["batch_s_ah_s"]), 4)]
                else:
                    buy_list_rth = arange_f(st.session_state["batch_b_rth_s"], st.session_state["batch_b_rth_e"], st.session_state["batch_b_rth_step"])
                    sell_list_rth = arange_f(st.session_state["batch_s_rth_s"], st.session_state["batch_s_rth_e"], st.session_state["batch_s_rth_step"])
                    buy_list_ah = arange_f(st.session_state["batch_b_ah_s"], st.session_state["batch_b_ah_e"], st.session_state["batch_b_ah_step"])
                    sell_list_ah = arange_f(st.session_state["batch_s_ah_s"], st.session_state["batch_s_ah_e"], st.session_state["batch_s_ah_step"])

            all_res = []
            all_trades = []
            total_syms = len(symbols)
            cur_idx = 0

            if split_batch and window_b != "ALL":
                st.info("Split thresholds are most effective with Window=ALL (contains both RTH and AH).")

            for symx in symbols:
                cur_idx += 1
                status.write(f"Running **{symx}** ({cur_idx}/{total_syms}) …")
                if export_trades:
                    res, tlog = run_grid_for_symbol(
                        server, db, user_id, symx,
                        d0, d1, window_b, t0, t1,
                        methods_b, int(lookback_n),
                        int(min_shares), float(min_dollar),
                        bool(apply_to_baseline), bool(apply_to_triggers),
                        int(participation_cap_pct),
                        (buy_list if not split_batch else []),
                        (sell_list if not split_batch else []),
                        float(start_capital),
                        surge_enable=False, t1_mult=2.0, t1_bonus=10.0, t2_mult=3.0, t2_bonus=10.0, surge_cap_pct=50.0,
                        progress=progress_cb, meta=meta_cb,
                        export_trades=True,
                        split_mode=bool(split_batch),
                        buy_list_rth=(buy_list_rth if split_batch else None),
                        sell_list_rth=(sell_list_rth if split_batch else None),
                        buy_list_ah=(buy_list_ah if split_batch else None),
                        sell_list_ah=(sell_list_ah if split_batch else None)
                    )
                    if not res.empty:
                        all_res.append(res)
                    if not tlog.empty:
                        all_trades.append(tlog.assign(symbol=symx) if "symbol" not in tlog.columns else tlog)
                else:
                    res = run_grid_for_symbol(
                        server, db, user_id, symx,
                        d0, d1, window_b, t0, t1,
                        methods_b, int(lookback_n),
                        int(min_shares), float(min_dollar),
                        bool(apply_to_baseline), bool(apply_to_triggers),
                        int(participation_cap_pct),
                        (buy_list if not split_batch else []),
                        (sell_list if not split_batch else []),
                        float(start_capital),
                        surge_enable=False, t1_mult=2.0, t1_bonus=10.0, t2_mult=3.0, t2_bonus=10.0, surge_cap_pct=50.0,
                        progress=progress_cb, meta=meta_cb,
                        export_trades=False,
                        split_mode=bool(split_batch),
                        buy_list_rth=(buy_list_rth if split_batch else None),
                        sell_list_rth=(sell_list_rth if split_batch else None),
                        buy_list_ah=(buy_list_ah if split_batch else None),
                        sell_list_ah=(sell_list_ah if split_batch else None)
                    )
                    if not res.empty:
                        all_res.append(res)

            prog.progress(100, text="Completed.")
            status.write("Batch complete.")

            if all_res:
                results = pd.concat(all_res, ignore_index=True)
                results["total_return_%"] = (results["total_return"] * 100.0).round(2)
                st.subheader("Leaderboard (All Symbols)")
                if split_batch and {"buy_pct_rth", "sell_pct_rth", "buy_pct_ah", "sell_pct_ah"}.issubset(results.columns):
                    show = results.sort_values(["total_return"], ascending=False).reset_index(drop=True)
                    st.dataframe(
                        show[["symbol", "method",
                              "buy_pct_rth", "sell_pct_rth", "buy_pct_ah", "sell_pct_ah",
                              "n_trades", "days_used", "ending_shares", "final_cash", "final_equity", "total_return_%"]],
                        use_container_width=True
                    )
                else:
                    show = results.sort_values(["total_return"], ascending=False).reset_index(drop=True)
                    st.dataframe(
                        show[["symbol", "method", "buy_pct", "sell_pct",
                              "n_trades", "days_used", "ending_shares", "final_cash", "final_equity", "total_return_%"]],
                        use_container_width=True
                    )

                # Best per symbol
                st.subheader("Best per Symbol")
                idx = results.groupby("symbol")["total_return"].idxmax()
                best = results.loc[idx].copy()
                best["total_return_%"] = (best["total_return"] * 100.0).round(2)
                if split_batch and {"buy_pct_rth", "sell_pct_rth", "buy_pct_ah", "sell_pct_ah"}.issubset(best.columns):
                    st.dataframe(
                        best.sort_values("symbol")[["symbol", "method",
                                                    "buy_pct_rth", "sell_pct_rth", "buy_pct_ah", "sell_pct_ah",
                                                    "n_trades", "days_used", "ending_shares", "final_cash", "final_equity", "total_return_%"]],
                        use_container_width=True
                    )
                    csv_best = best.sort_values("symbol")[["symbol", "method", "buy_pct_rth", "sell_pct_rth", "buy_pct_ah", "sell_pct_ah",
                                                           "n_trades", "days_used", "ending_shares", "final_cash", "final_equity", "total_return_%"]].to_csv(index=False).encode("utf-8")
                else:
                    st.dataframe(
                        best.sort_values("symbol")[["symbol", "method", "buy_pct", "sell_pct",
                                                    "n_trades", "days_used", "ending_shares", "final_cash", "final_equity", "total_return_%"]],
                        use_container_width=True
                    )
                    csv_best = best.sort_values("symbol")[["symbol", "method", "buy_pct", "sell_pct",
                                                           "n_trades", "days_used", "ending_shares", "final_cash", "final_equity", "total_return_%"]].to_csv(index=False).encode("utf-8")

                # Download CSVs
                csv_all = results.to_csv(index=False).encode("utf-8")
                st.download_button("Download All Results (CSV)", data=csv_all,
                                   file_name=f"{'batch_split' if split_batch else 'batch_grid'}_{d0}_{d1}.csv", mime="text/csv", key="dl_all")
                st.download_button("Download Best per Symbol (CSV)", data=csv_best,
                                   file_name=f"{'batch_split_best' if split_batch else 'batch_grid_best'}_{d0}_{d1}.csv", mime="text/csv", key="dl_best")
            else:
                st.warning("No results (check data availability and filters).")

            if export_trades and all_trades:
                trades_df = pd.concat(all_trades, ignore_index=True)
                for col in ["price", "ratio", "base"]:
                    if col in trades_df.columns:
                        trades_df[col] = trades_df[col].astype(float).round(8 if col != "price" else 6)
                st.subheader("Per‑trade log")
                st.dataframe(trades_df, use_container_width=True, hide_index=True)
                st.download_button(
                    "Download Per‑trade Log (CSV)",
                    data=trades_df.to_csv(index=False).encode("utf-8"),
                    file_name=f"{'batch_split_trades' if split_batch else 'batch_trades'}_{d0}_{d1}.csv",
                    mime="text/csv",
                    key="dl_trades"
                )


# ---- Batch (Fast) — Daily (per-day winners + confidence) ----
with tab_batch_daily:
    st.subheader("Batch (Fast) — Daily: best (method, thresholds) per day + confidence")

    syms = sorted(set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))) | set(DEFAULT_SYMBOLS))
    symbols = st.multiselect("Symbols", options=syms, default=syms[:9], key="bfd_syms")

    c_d = st.columns(2)
    with c_d[0]:
        d0 = st.date_input("Start date (ET)", value=date.today() - timedelta(days=30), key="bfd_start_date")
    with c_d[1]:
        d1 = st.date_input("End date (ET)", value=date.today() - timedelta(days=1), key="bfd_end_date")

    window_b = st.selectbox("Window (ET)", ["ALL", "RTH", "AH", "CUSTOM"], index=0, key="bfd_window")
    t0 = t1 = None
    if window_b == "CUSTOM":
        cc = st.columns(2)
        with cc[0]:
            t0 = st.time_input("Custom start ET", value=dtime(9, 30, 0), key="bfd_ct0")
        with cc[1]:
            t1 = st.time_input("Custom end ET", value=dtime(16, 0, 0), key="bfd_ct1")

    methods_b = st.multiselect("Baseline methods", BASELINE_METHODS,
                               default=["WINSORIZED", "VOL_WEIGHTED", "WEIGHTED_MEDIAN", "VWAP_RATIO", "EQUAL_MEAN"],
                               key="bfd_methods")
    lookback_n = st.number_input("Use previous N trading days", min_value=1, max_value=5, value=1, step=1, key="bfd_lbk")

    st.markdown("**Liquidity filters**")
    lc1, lc2, lc3 = st.columns(3)
    with lc1:
        min_shares = st.number_input("Min shares/min", min_value=0, value=0, step=100, key="bfd_min_shares")
    with lc2:
        min_dollar = st.number_input("Min $/min", min_value=0, value=0, step=1000, key="bfd_min_dollar")
    with lc3:
        participation_cap_pct = st.number_input("Max % of minute volume", min_value=0, max_value=100, value=0, step=1, key="bfd_partcap")
    apply_to_baseline = st.checkbox("Apply filters to baseline days", value=True, key="bfd_filt_prev")
    apply_to_triggers = st.checkbox("Apply filters to trigger days", value=True, key="bfd_filt_curr")

    st.markdown("**Thresholds**")
    single_pair = st.checkbox("Run single thresholds (ignore ranges)", value=True, key="bfd_single_pair")

    def arange_f(a, b, s):
        if a is None:
            return []
        if s is None or s <= 0:
            return [float(a)]
        out = []
        x = float(a)
        while x <= float(b) + 1e-9:
            out.append(round(x, 4))
            x += float(s)
        return out

    c_b = st.columns(3)
    with c_b[0]:
        buy_start = st.number_input("Buy% start", min_value=0.0, max_value=10.0, value=0.5, step=0.1, key="bfd_bstart")
    with c_b[1]:
        buy_end = st.number_input("Buy% end", min_value=0.0, max_value=10.0, value=2.0, step=0.1, key="bfd_bend", disabled=single_pair)
    with c_b[2]:
        buy_step = st.number_input("Buy% step", min_value=0.1, max_value=2.0, value=0.1, step=0.1, key="bfd_bstep", disabled=single_pair)

    c_s = st.columns(3)
    with c_s[0]:
        sell_start = st.number_input("Sell% start", min_value=0.0, max_value=10.0, value=1.0, step=0.1, key="bfd_sstart")
    with c_s[1]:
        sell_end = st.number_input("Sell% end", min_value=0.0, max_value=10.0, value=4.0, step=0.1, key="bfd_send", disabled=single_pair)
    with c_s[2]:
        sell_step = st.number_input("Sell% step", min_value=0.1, max_value=2.0, value=0.1, step=0.1, key="bfd_sstep", disabled=single_pair)

    start_capital = st.number_input("Start capital per day ($)", min_value=100.0, value=10000.0, step=100.0, key="bfd_start_cap")
    corr_horizon = st.number_input("Confidence horizon (forward minutes)", min_value=1, max_value=60, value=10, step=1, key="bfd_hz")

    run_daily = st.button("Run Batch Fast — Daily", type="primary", key="run_bfd_btn")

    meta_placeholder = st.empty()
    prog = st.progress(0, text="Idle.")
    status = st.empty()

    if run_daily:
        if not symbols:
            st.error("Select at least one symbol.")
        elif not methods_b:
            st.error("Select at least one baseline method.")
        elif d1 < d0:
            st.error("End date must be on/after start date.")
        else:
            if single_pair:
                buy_list = [round(float(st.session_state["bfd_bstart"]), 4)]
                sell_list = [round(float(st.session_state["bfd_sstart"]), 4)]
            else:
                buy_list = arange_f(st.session_state["bfd_bstart"], st.session_state["bfd_bend"], st.session_state["bfd_bstep"])
                sell_list = arange_f(st.session_state["bfd_sstart"], st.session_state["bfd_send"], st.session_state["bfd_sstep"])

            all_days = []
            all_summ = []
            total_syms = len(symbols)
            for i, symx in enumerate(symbols, start=1):
                status.write(f"Running **{symx}** ({i}/{total_syms}) …")
                prog.progress(int(100 * i / total_syms), text=f"{symx}: {i}/{total_syms}")
                daily_df, summ_df = run_daily_best_for_symbol(
                    server, db, user_id, symx,
                    d0, d1, window_b, t0, t1,
                    methods_b, int(lookback_n),
                    int(min_shares), float(min_dollar),
                    bool(apply_to_baseline), bool(apply_to_triggers),
                    int(participation_cap_pct),
                    buy_list, sell_list,
                    float(start_capital),
                    corr_horizon=int(corr_horizon)
                )
                if not daily_df.empty:
                    all_days.append(daily_df.assign(symbol=symx) if "symbol" not in daily_df.columns else daily_df)
                if not summ_df.empty:
                    all_summ.append(summ_df.assign(symbol=symx) if "symbol" not in summ_df.columns else summ_df)

            prog.progress(100, text="Completed.")
            status.write("Batch Fast — Daily complete.")

            if all_days:
                daily_res = pd.concat(all_days, ignore_index=True)
                daily_res["day_return_%"] = (daily_res["day_return"] * 100.0).round(2)
                st.subheader("Per‑day winners")
                st.dataframe(daily_res.sort_values(["symbol", "et_date"]), use_container_width=True, hide_index=True)
                st.download_button(
                    "Download Daily Winners (CSV)",
                    data=daily_res.to_csv(index=False).encode("utf-8"),
                    file_name=f"batch_fast_daily_winners_{d0}_{d1}.csv",
                    mime="text/csv",
                    key="bfd_days_csv"
                )
            else:
                st.warning("No per‑day winners produced.")

            if all_summ:
                summ = pd.concat(all_summ, ignore_index=True)
                st.subheader("Consistency by Method")
                st.dataframe(summ, use_container_width=True, hide_index=True)
                st.download_button(
                    "Download Consistency Summary (CSV)",
                    data=summ.to_csv(index=False).encode("utf-8"),
                    file_name=f"batch_fast_daily_summary_{d0}_{d1}.csv",
                    mime="text/csv",
                    key="bfd_summ_csv"
                )
            else:
                st.info("No consistency summary (no winners).")

# ---- Trade Detail ----
with tab_detail:
    st.subheader("Trade Detail (per symbol / method / thresholds) — with ±5‑minute liquidity context")
    all_syms = sorted(set(DEFAULT_SYMBOLS) | set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))))
    sym = st.selectbox("Symbol", all_syms,
                       index=(DEFAULT_SYMBOLS.index("CIFR") if "CIFR" in DEFAULT_SYMBOLS else 0),
                       key="td_sym")
    method = st.selectbox("Baseline method", BASELINE_METHODS, index=0, key="td_method")
    st.session_state["trade_method_name"] = method

    window = st.selectbox("Window", ["RTH", "CUSTOM", "AH", "ALL"], index=1, key="td_window")
    cstart = st.text_input("Custom start (ET)", "09:30:00", key="td_cstart")
    cend = st.text_input("Custom end (ET)", "16:00:00", key="td_cend")
    n_prev = st.number_input("Prev trading days to average (N)", min_value=1, value=1, step=1, key="td_nprev")

    c3, c4, c5 = st.columns(3)
    with c3:
        start_d = st.date_input("Start date (ET)", value=date.today() - timedelta(days=30), key="td_start")
    with c4:
        end_d = st.date_input("End date (ET)", value=date.today() - timedelta(days=1), key="td_end")
    with c5:
        init_cap = st.number_input("Initial capital ($)", value=10000.0, step=100.0, format="%.2f", key="td_init")

    b1, b2, _ = st.columns(3)
    with b1:
        buy_pct = st.number_input("Buy % (above baseline)", value=0.5, step=0.1, format="%.1f", key="td_buy")
    with b2:
        sell_pct = st.number_input("Sell % (below baseline)", value=1.0, step=0.1, format="%.1f", key="td_sell")

    flatten_eod = st.checkbox("Force flat at end of each day (optional)", value=False, key="td_flatten")

    if st.button("Generate Trade Detail", key="td_run"):
        try:
            if start_d >= end_d:
                st.error("Start must be earlier than End.")
                st.stop()

            df = fetch_join_minutes(server, db, user_id, sym, start_d, end_d)
            df = filter_window_str(df, window, cstart, cend)
            if df.empty:
                st.warning("No joined minutes in this range/window.")
                st.stop()

            base_map = compute_daily_baselines_single(
                server, db, user_id, sym,
                start_d, end_d, window, cstart, cend,
                method, n_prev=int(n_prev)
            )
            if not base_map:
                st.warning("No prior-day baseline available for this range (missing previous trading days).")
                st.stop()

            st.info(f"{sym}: {len(base_map)} current day(s) have a {method} baseline (avg of last {int(n_prev)} day(s)).")

            detail = simulate_trade_detail(
                df_all=df,
                method_map=base_map,
                symbol=sym,
                buy_pct=float(buy_pct),
                sell_pct=float(sell_pct),
                init_cap=float(init_cap),
                flatten_eod=bool(flatten_eod)
            )
            if detail.empty:
                st.warning("No trades triggered with these thresholds / range.")
            else:
                pretty = detail.copy()
                for c in ["price", "ratio", "base", "minute_value", "ten_min_value", "day_total_value"]:
                    if c in pretty.columns:
                        pretty[c] = pretty[c].astype(float).round(4 if c in ["price", "minute_value", "ten_min_value", "day_total_value"] else 6)
                st.dataframe(pretty, use_container_width=True)
                st.download_button(
                    "Download Trade Detail CSV",
                    data=pretty.to_csv(index=False).encode("utf-8"),
                    file_name=f"trade_detail_{sym}_{start_d}_{end_d}_{method}_B{buy_pct}_S{sell_pct}.csv",
                    mime="text/csv",
                    key="td_dl"
                )

        except Exception as e:
            st.error(f"Trade detail error: {e}")

# ---- Coverage ----
with tab_cov:
    st.subheader("Coverage (stock minutes, BTC minutes, matched)")
    all_syms = sorted(set(DEFAULT_SYMBOLS) | set(get_symbols(engine, user_id, st.session_state.get("sym_ver", 0))))
    sym_c = st.selectbox("Symbol (coverage)", all_syms,
                         index=(DEFAULT_SYMBOLS.index("CIFR") if "CIFR" in DEFAULT_SYMBOLS else 0),
                         key="cov_sym")
    start_c = st.date_input("Start (ET)", value=date.today() - timedelta(days=60), key="cov_start")
    end_c = st.date_input("End (ET)", value=date.today() - timedelta(days=1), key="cov_end")
    if st.button("Run coverage report", key="cov_run"):
        try:
            q = """
            WITH S AS (
              SELECT et_date
              FROM dbo.lab_price_history
              WHERE user_id=? AND symbol=? AND et_date BETWEEN ? AND ?
              GROUP BY et_date
            ),
            A AS (
              SELECT et_date, COUNT(*) AS stock_minutes
              FROM dbo.lab_price_history
              WHERE user_id=? AND symbol=? AND et_date BETWEEN ? AND ?
              GROUP BY et_date
            ),
            B AS (
              SELECT et_date, COUNT(*) AS btc_minutes
              FROM dbo.lab_btc_history
              WHERE user_id=? AND et_date BETWEEN ? AND ?
              GROUP BY et_date
            ),
            M AS (
              SELECT ph.et_date, COUNT(*) AS matched_minutes
              FROM dbo.lab_price_history ph
              JOIN dbo.lab_btc_history   bh
                ON bh.user_id=ph.user_id AND bh.ts_utc=ph.ts_utc
              WHERE ph.user_id=? AND ph.symbol=? AND ph.et_date BETWEEN ? AND ?
              GROUP BY ph.et_date
            )
            SELECT S.et_date,
                   COALESCE(A.stock_minutes,0)   AS stock_minutes,
                   COALESCE(B.btc_minutes,0)     AS btc_minutes,
                   COALESCE(M.matched_minutes,0) AS matched_minutes
            FROM S
            LEFT JOIN A ON A.et_date=S.et_date
            LEFT JOIN B ON B.et_date=S.et_date
            LEFT JOIN M ON M.et_date=S.et_date
            ORDER BY S.et_date ASC;
            """
            params = (
                user_id, sym_c, str(start_c), str(end_c),
                user_id, sym_c, str(start_c), str(end_c),
                user_id, str(start_c), str(end_c),
                user_id, sym_c, str(start_c), str(end_c)
            )
            dfcov = pd_read_sql(q, server, db, params=params)
            if dfcov.empty:
                st.warning("No days found for this symbol in the selected range.")
            else:
                st.dataframe(dfcov, use_container_width=True)
        except Exception as e:
            st.error(f"Coverage error: {e}")

# ---- Data ----
with tab_data:
    st.subheader("Data summary")
    try:
        n_btc = int(pd_read_sql("SELECT COUNT(*) AS n FROM dbo.lab_btc_history WHERE user_id=?", server, db, (user_id,)).iloc[0]["n"])
        st.metric("BTC minute rows", f"{n_btc:,}")
        dfc = pd_read_sql(
            "SELECT symbol, COUNT(*) AS n FROM dbo.lab_price_history WHERE user_id=? GROUP BY symbol ORDER BY symbol",
            server, db, (user_id,)
        )
        st.dataframe(dfc, use_container_width=True)
    except Exception as e:
        st.error(f"DB error: {e}")

    with st.expander("Help / Field Guide — Schema & Performance"):
        st.markdown(HELP_SCHEMA_MD)

# ---------------- README (collapsible) ----------------
README_MD = r"""
**Dependencies (Windows laptop/PC, SQL Server at e.g. `LLDT\SQLEXPRESS`):**
```bash
pip install --upgrade streamlit pandas numpy sqlalchemy pyodbc requests tzdata
```
Also install a Microsoft ODBC driver for SQL Server (17 or 18).

**Run the app:**
```bash
streamlit run baseline_unified_app_fast.py --server.address 0.0.0.0 --server.port 8501
```

**What makes this build faster**
- **Covering indexes** on raw tables (include `et_time`) + **join-friendly** `(user_id, ts_utc)` indexes.
- A **pre-joined minute table** with stored `ratio`, `dollar_volume`, and real `is_rth` column — auto-refreshed for the symbols/date ranges you run.
- All heavy joins done in SQL; Python avoids merging per day and re-scanning redundant ranges.
"""
with st.expander("Installation & Run Instructions"):
    st.markdown(README_MD)
