
import argparse
import sys
import numpy as np
import pandas as pd
from pathlib import Path

try:
    import pyodbc
except Exception:
    pyodbc = None

def winsorize(arr, lower=0.05, upper=0.95):
    a = np.asarray(arr, dtype=float)
    a = a[np.isfinite(a)]
    if a.size == 0: return np.nan
    lo = np.quantile(a, lower); hi = np.quantile(a, upper)
    a = np.clip(a, lo, hi)
    return float(np.mean(a))

def vol_weighted_ratio(ratio, vol):
    r = np.asarray(ratio, dtype=float)
    w = np.asarray(vol, dtype=float)
    w = np.where(np.isfinite(w), w, 0.0)
    r = np.where(np.isfinite(r), r, np.nan)
    if w.sum() <= 0: return np.nan
    mask = np.isfinite(r)
    if not np.any(mask): return np.nan
    return float(np.nansum(r[mask] * w[mask]) / np.nansum(w[mask]))

def vwap(values, volumes):
    p = np.asarray(values, dtype=float)
    v = np.asarray(volumes, dtype=float)
    mask = np.isfinite(p) & np.isfinite(v) & (v > 0)
    if not np.any(mask): return np.nan
    return float(np.sum(p[mask] * v[mask]) / np.sum(v[mask]))

def normalize_session_from_time(et_time_series):
    from datetime import time as _time
    rth_start = _time(9,30); rth_end = _time(16,0)
    t = pd.to_datetime(et_time_series, errors="coerce").dt.time
    return np.where((pd.Series(t) >= rth_start) & (pd.Series(t) <= rth_end), "RTH", "AH")

def compute_baselines(df):
    need = ["symbol","et_date","et_time","stock_close","stock_volume","btc_close","btc_volume"]
    rename_map = {}
    # Accept either stock_close or stock_c, etc.
    if "c" in df.columns and "stock_close" not in df.columns: rename_map["c"] = "stock_close"
    if "v" in df.columns and "stock_volume" not in df.columns: rename_map["v"] = "stock_volume"
    if "btc_c" in df.columns and "btc_close" not in df.columns: rename_map["btc_c"] = "btc_close"
    if "btc_v" in df.columns and "btc_volume" not in df.columns: rename_map["btc_v"] = "btc_volume"
    if "vw" in df.columns and "stock_vw" not in df.columns and "btc_vw" not in df.columns:
        # We'll rename later per source columns
        pass
    df = df.rename(columns=rename_map)

    # Normalize expected names from the view columns
    # View will expose stock_* and btc_* already; keep flexible just in case
    colmap = {
        "stock_close": ["stock_close","stock_c","c"],
        "stock_volume": ["stock_volume","stock_v","v"],
        "btc_close": ["btc_close","btc_c"],
        "btc_volume": ["btc_volume","btc_v"],
        "btc_vw": ["btc_vw"],
    }
    def pick(df, options):
        for o in options:
            if o in df.columns: return o
        return None

    sc = pick(df, colmap["stock_close"]); sv = pick(df, colmap["stock_volume"])
    bc = pick(df, colmap["btc_close"]);   bv = pick(df, colmap["btc_volume"])
    bvw = pick(df, colmap["btc_vw"])

    for req in [sc, sv, bc, bv]:
        if req is None: raise SystemExit("Missing required price/volume columns.")

    df["et_date"] = pd.to_datetime(df["et_date"], errors="coerce").dt.date
    df["et_time"] = pd.to_datetime(df["et_time"], errors="coerce").dt.time
    df[sc] = pd.to_numeric(df[sc], errors="coerce")
    df[sv] = pd.to_numeric(df[sv], errors="coerce")
    df[bc] = pd.to_numeric(df[bc], errors="coerce")
    df[bv] = pd.to_numeric(df[bv], errors="coerce")
    if bvw and bvw in df.columns:
        df[bvw] = pd.to_numeric(df[bvw], errors="coerce")

    if "session" not in df.columns:
        df["session"] = normalize_session_from_time(df["et_time"])
    df["ratio"] = np.where(df[sc] > 0, df[bc] / df[sc], np.nan)
    df["hour"] = pd.to_datetime(df["et_time"].astype(str), errors="coerce").dt.hour

    def agg_block(g):
        r = g["ratio"].to_numpy(dtype=float)
        vol = g[sv].to_numpy(dtype=float)  # weight by stock volume
        eq_mean = float(np.nanmean(r)) if r.size else np.nan
        med     = float(np.nanmedian(r)) if r.size else np.nan
        vol_w   = vol_weighted_ratio(r, vol)
        win_m   = winsorize(r, 0.05, 0.95)
        btc_vwap = vwap(g[bc], g[bv])
        stk_vwap = vwap(g[sc], g[sv])
        vwr = (btc_vwap / stk_vwap) if (np.isfinite(stk_vwap) and stk_vwap != 0) else np.nan
        rows = [
            ("EQUAL_MEAN",   eq_mean, len(g)),
            ("MEDIAN",       med,     len(g)),
            ("VOL_WEIGHTED", vol_w,   len(g)),
            ("WINSORIZED",   win_m,   len(g)),
            ("VWAP_RATIO",   float(vwr) if np.isfinite(vwr) else np.nan, len(g)),
        ]
        return pd.DataFrame(rows, columns=["method","baseline","samples"])

    frames = []
    for (d, sym, sess), g in df.groupby(["et_date","symbol","session"], sort=True):
        out = agg_block(g)
        out.insert(0, "symbol", sym)
        out.insert(0, "session", sess)
        out.insert(0, "baseline_date", d)
        frames.append(out)
    daily = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(
        columns=["baseline_date","session","symbol","method","baseline","samples"]
    )

    frames_h = []
    for (d, h, sym, sess), g in df.groupby(["et_date","hour","symbol","session"], sort=True):
        out = agg_block(g)
        out.insert(0, "symbol", sym)
        out.insert(0, "session", sess)
        out.insert(0, "hour", h)
        out.insert(0, "baseline_date", d)
        frames_h.append(out)
    hourly = pd.concat(frames_h, ignore_index=True) if frames_h else pd.DataFrame(
        columns=["baseline_date","hour","session","symbol","method","baseline","samples"]
    )
    return daily, hourly

def fetch_from_view(server, database, start, end, trusted=True, username=None, password=None):
    if pyodbc is None:
        raise SystemExit("pyodbc not installed. Install with: pip install pyodbc")
    if trusted:
        conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;"
    else:
        if not (username and password):
            raise SystemExit("Provide --username and --password when --trusted no")
        conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};"
    cn = pyodbc.connect(conn_str)
    sql = """
      SELECT *
      FROM [dbo].[Baseline_daily2]
      WHERE CAST(et_date AS date) BETWEEN ? AND ?
    """
    df = pd.read_sql(sql, cn, params=[start, end])
    cn.close()
    return df

def main():
    ap = argparse.ArgumentParser(description="Export baselines (daily & hourly) from dbo.Baseline_daily2 view.")
    ap.add_argument("--server", default=r"LLDT\\SQLEXPRESS")
    ap.add_argument("--database", default="streamlit")
    ap.add_argument("--trusted", default="yes", choices=["yes","no"])
    ap.add_argument("--username")
    ap.add_argument("--password")
    ap.add_argument("--start", required=True, help="YYYY-MM-DD")
    ap.add_argument("--end", required=True, help="YYYY-MM-DD")
    ap.add_argument("--outdir", help="Output directory (default: current folder)")
    args = ap.parse_args()

    trusted = (args.trusted.lower() == "yes")
    outdir = Path(args.outdir) if args.outdir else Path.cwd()
    outdir.mkdir(parents=True, exist_ok=True)

    print("Fetching data from dbo.Baseline_daily2 ...")
    df = fetch_from_view(
        server=args.server, database=args.database,
        start=args.start, end=args.end,
        trusted=trusted, username=args.username, password=args.password
    )
    if df.empty:
        print("No rows for given dates.")
        sys.exit(0)

    # Map columns from the Baseline_daily2 view into expected names
    # Expected from the view:
    #   symbol, ts_utc, et_date, et_time, et_dow,
    #   stock_open, stock_close, stock_volume, stock_vw, stock_trades,
    #   btc_open, btc_close, btc_volume, btc_vw, btc_trades
    # If names differ, adapt here.
    rename = {}
    if "o" in df.columns and "stock_open" not in df.columns: rename["o"] = "stock_open"
    if "c" in df.columns and "stock_close" not in df.columns: rename["c"] = "stock_close"
    if "v" in df.columns and "stock_volume" not in df.columns: rename["v"] = "stock_volume"
    if "vw" in df.columns and "stock_vw" not in df.columns: rename["vw"] = "stock_vw"
    if "n_trades" in df.columns and "stock_trades" not in df.columns: rename["n_trades"] = "stock_trades"
    if "btc_c" in df.columns: rename["btc_c"] = "btc_close"
    if "btc_v" in df.columns: rename["btc_v"] = "btc_volume"

    df = df.rename(columns=rename)

    daily, hourly = compute_baselines(df)

    p1 = outdir / "baseline_daily2.csv"
    p2 = outdir / "baseline_hourly.csv"
    daily.to_csv(p1, index=False)
    hourly.to_csv(p2, index=False)

    print("Saved:")
    print(" -", p1)
    print(" -", p2)
    print("\nExamples (PowerShell):")
    print(r'  python ".\export_baselines_from_view.py" --start 2025-09-25 --end 2025-10-17')
    print(r'  python ".\export_baselines_from_view.py" --server "LLDT\\SQLEXPRESS" --database "streamlit" --trusted yes --start 2025-10-01 --end 2025-10-17')

if __name__ == "__main__":
    main()
