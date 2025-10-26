
# bitcorr_analyzer_pro.py
# Streamlit app for advanced analysis of BitCorr SQL warehouse.
import os
from datetime import date, datetime, timedelta, time as dtime
from typing import Optional, List, Dict, Tuple

import numpy as np
import pandas as pd
import pyodbc
import streamlit as st
import matplotlib.pyplot as plt

st.set_page_config(page_title="BitCorr Analyzer — Pro", layout="wide")

# -----------------------------
# Connection & SQL helpers
# -----------------------------
def get_cnx(server: str, db: str):
    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server={server};"
        f"Database={db};"
        "Trusted_Connection=yes;"
        "Encrypt=no;"
    )
    return pyodbc.connect(conn_str, timeout=60)

@st.cache_data(show_spinner=False)
def pd_read_sql(q: str, server: str, db: str, params=None) -> pd.DataFrame:
    cn = get_cnx(server, db)
    try:
        df = pd.read_sql(q, cn, params=params)
    finally:
        cn.close()
    return df

# -----------------------------
# Sidebar
# -----------------------------
with st.sidebar:
    st.header("🔌 Connection")
    server = st.text_input("SQL Server", value=os.getenv("BITCORR_SQL_SERVER", "LLDT\\SQLEXPRESS"))
    database = st.text_input("Database", value=os.getenv("BITCORR_SQL_DB", "streamlit"))
    user_id = st.text_input("User tag (user_id)", value=os.getenv("BITCORR_USER_ID", "default"))

    st.divider()
    st.header("📅 Filters")

    try:
        meta_df = pd_read_sql(
            "SELECT MIN(et_date) AS min_d, MAX(et_date) AS max_d FROM dbo.bitcorr_daily_actions WITH (NOLOCK) WHERE user_id = ?;",
            server, database, params=(user_id,)
        )
        min_d = pd.to_datetime(meta_df["min_d"].iloc[0]).date() if not meta_df.empty else date.today() - timedelta(days=365)
        max_d = pd.to_datetime(meta_df["max_d"].iloc[0]).date() if not meta_df.empty else date.today()
    except Exception:
        min_d = date.today() - timedelta(days=365); max_d = date.today()

    d0 = st.date_input("Start date (ET)", value=max(min_d, max_d - timedelta(days=365)))
    d1 = st.date_input("End date (ET)", value=max_d)

    sessions = st.multiselect("Sessions", options=["RTH", "AH", "ALL", "CUSTOM"], default=["RTH","AH"])

    # Symbols
    try:
        sym_df = pd_read_sql(
            "SELECT DISTINCT symbol FROM dbo.bitcorr_daily_actions WITH (NOLOCK) WHERE user_id = ? ORDER BY symbol;",
            server, database, params=(user_id,)
        )
        symbols_all = sorted(sym_df["symbol"].dropna().astype(str).tolist())
    except Exception:
        symbols_all = []
    symbols = st.multiselect("Symbols", options=symbols_all, default=symbols_all[:6] if symbols_all else [])

    # Methods
    try:
        meth_df = pd_read_sql(
            "SELECT DISTINCT method FROM dbo.bitcorr_daily_actions WITH (NOLOCK) WHERE user_id = ? ORDER BY method;",
            server, database, params=(user_id,)
        )
        methods_all = sorted(meth_df["method"].dropna().astype(str).tolist())
    except Exception:
        methods_all = []
    methods = st.multiselect("Baseline Methods", options=methods_all, default=methods_all)

    st.divider()
    st.header("⚙️ Thresholds")
    col_thr = st.columns(2)
    with col_thr[0]:
        buy_min = st.number_input("Buy% min", value=0.1, step=0.1, min_value=0.0)
        buy_max = st.number_input("Buy% max", value=3.0, step=0.1, min_value=0.0)
    with col_thr[1]:
        sell_min = st.number_input("Sell% min", value=0.1, step=0.1, min_value=0.0)
        sell_max = st.number_input("Sell% max", value=3.0, step=0.1, min_value=0.0)

    st.divider()
    st.header("📈 Confidence horizon")
    default_conf_h = st.selectbox("Default horizon", options=[10,5,15,0], index=0)

# -----------------------------
# Data loader
# -----------------------------
@st.cache_data(show_spinner=True, ttl=300)
def load_actions(server: str, db: str, user_id: str,
                 symbols: List[str], sessions: List[str], d0: date, d1: date,
                 methods: List[str],
                 buy_min: float, buy_max: float, sell_min: float, sell_max: float) -> pd.DataFrame:
    if not symbols or not sessions:
        return pd.DataFrame()
    syms = ",".join([f"'{s}'" for s in symbols])
    sess = ",".join([f"'{s}'" for s in sessions])
    meth = ",".join([f"'{m}'" for m in methods]) if methods else None
    meth_filter = f"AND method IN ({meth})" if meth else ""

    q = f"""
    SELECT user_id, symbol, session, et_date, method, buy_pct, sell_pct,
           day_return, n_trades, baseline,
           corr_pearson, corr_spearman, confidence,
           corr_pearson_0m, corr_spearman_0m, confidence_0m,
           corr_pearson_5m, corr_spearman_5m, confidence_5m,
           corr_pearson_10m, corr_spearman_10m, confidence_10m,
           corr_pearson_15m, corr_spearman_15m, confidence_15m,
           btc_prev_ret, btc_prev_vol, btc_prev_range, btc_overnight_ret,
           open_gap_z, liq_median, liq_p10, liq_p90
    FROM dbo.bitcorr_daily_actions WITH (NOLOCK)
    WHERE user_id = ?
      AND symbol IN ({syms})
      AND session IN ({sess})
      AND et_date BETWEEN ? AND ?
      {meth_filter}
      AND buy_pct BETWEEN ? AND ?
      AND sell_pct BETWEEN ? AND ?;
    """
    params = (user_id, str(d0), str(d1), float(buy_min), float(buy_max), float(sell_min), float(sell_max))
    df = pd_read_sql(q, server, db, params=params)
    if not df.empty:
        df["et_date"] = pd.to_datetime(df["et_date"]).dt.date
        df["buy_pct"] = df["buy_pct"].astype(float)
        df["sell_pct"] = df["sell_pct"].astype(float)
        df["day_return"] = df["day_return"].astype(float)
        df["n_trades"] = df["n_trades"].astype(int)
    return df

df = load_actions(server, database, user_id, symbols, sessions, d0, d1, methods, buy_min, buy_max, sell_min, sell_max)

# -----------------------------
# Helpers
# -----------------------------
def equity_from_returns(ret, start_capital: float = 1.0) -> pd.Series:
    ret = pd.Series(ret)
    eq = (1.0 + ret.fillna(0.0)).cumprod() * start_capital
    return eq

def sharpe_like(x: pd.Series) -> float:
    m = np.nanmean(x); s = np.nanstd(x)
    return float(m / s) if s and np.isfinite(s) else 0.0

def drawdown_stats(series: pd.Series) -> Tuple[float, float, float]:
    """Return max drawdown, average drawdown, and Calmar-like (CAGR / |maxDD|)"""
    s = series.astype(float)
    peak = s.cummax()
    dd = (s / peak) - 1.0
    max_dd = float(dd.min()) if len(dd) else 0.0
    avg_dd = float(dd.mean()) if len(dd) else 0.0
    # naive CAGR: (end/start)^(1/years)-1, assuming 252 trading days/year
    if len(s) >= 2:
        cagr = float((s.iloc[-1] / s.iloc[0]) ** (252.0 / max(len(s),1)) - 1.0)
    else:
        cagr = 0.0
    calmar_like = float(cagr / abs(max_dd)) if max_dd < 0 else np.nan
    return max_dd, avg_dd, calmar_like

def regime_bins(x: pd.Series, bins: int = 5) -> pd.Series:
    try:
        return pd.qcut(x.replace([np.inf,-np.inf], np.nan), q=bins, labels=False, duplicates="drop")
    except Exception:
        return pd.Series(np.full(len(x), np.nan))

def pick_conf_cols(h: int) -> Tuple[str,str,str]:
    if h == 0: return "corr_pearson_0m","corr_spearman_0m","confidence_0m"
    if h == 5: return "corr_pearson_5m","corr_spearman_5m","confidence_5m"
    if h == 10: return "corr_pearson_10m","corr_spearman_10m","confidence_10m"
    if h == 15: return "corr_pearson_15m","corr_spearman_15m","confidence_15m"
    return "corr_pearson_10m","corr_spearman_10m","confidence_10m"

# -----------------------------
# Tabs
# -----------------------------
tab_stability, tab_symboldash, tab_rules, tab_constrained, tab_tc, tab_live = st.tabs([
    "Method Stability", "Per-Symbol Dashboards", "Rule Table Exporter", "Constrained Policies (ROI)",
    "Transaction Costs", "Live Policy Scorer"
])

# -----------------------------
# Method Stability
# -----------------------------
with tab_stability:
    st.markdown("### 📈 Method Stability")
    if df.empty:
        st.info("Load data to analyze stability.")
    else:
        agg_method = st.selectbox("Aggregate per day by", options=["Best-of-grid per method","Average across thresholds"], index=0)
        # Build per-method daily series
        ser = []
        for m in sorted(df["method"].unique().tolist()):
            sub = df[df["method"] == m]
            if agg_method == "Best-of-grid per method":
                perday = sub.sort_values(["et_date","day_return"], ascending=[True,False]).drop_duplicates(["et_date"])
            else:
                perday = sub.groupby("et_date", as_index=False)["day_return"].mean()
            perday = perday.sort_values("et_date")
            eq = equity_from_returns(perday["day_return"], 1.0)
            max_dd, avg_dd, calmar_like = drawdown_stats(eq)
            sharpe = sharpe_like(perday["day_return"])
            ser.append({"method": m, "days": len(perday), "mean_ret": float(perday["day_return"].mean()),
                        "sharpe": sharpe, "max_drawdown": max_dd, "avg_drawdown": avg_dd, "calmar_like": calmar_like})
        st.dataframe(pd.DataFrame(ser).sort_values("mean_ret", ascending=False), use_container_width=True)

# -----------------------------
# Per-Symbol Dashboards
# -----------------------------
with tab_symboldash:
    st.markdown("### 🧭 Per-Symbol Dashboards (RTH vs AH)")
    if df.empty:
        st.info("Load data to see symbol dashboards.")
    else:
        sym_pick = st.selectbox("Symbol", options=sorted(df["symbol"].unique().tolist()))
        sdf = df[df["symbol"] == sym_pick]
        for sess in ["RTH","AH"]:
            ss = sdf[sdf["session"] == sess]
            if ss.empty:
                st.caption(f"{sym_pick} — {sess}: no data")
                continue
            # Best per day (oracle within symbol-session)
            winners = ss.sort_values(["et_date","day_return"], ascending=[True,False]).drop_duplicates(["et_date"])
            eq = equity_from_returns(winners["day_return"], 1.0)
            fig, ax = plt.subplots()
            ax.plot(winners["et_date"], eq)
            ax.set_title(f"{sym_pick} — {sess} winners equity")
            ax.set_xlabel("Date"); ax.set_ylabel("Equity"); ax.grid(True, alpha=0.2)
            st.pyplot(fig, use_container_width=True)

            summary = ss.groupby("method", as_index=False).agg(
                mean_ret=("day_return","mean"),
                sharpe=("day_return", lambda x: float(np.nanmean(x)/np.nanstd(x)) if np.nanstd(x) else 0.0),
                support=("day_return","size"),
                conf10=("confidence_10m","mean")
            ).sort_values("mean_ret", ascending=False).head(20)
            st.dataframe(summary, use_container_width=True)

# -----------------------------
# Rule Table Exporter
# -----------------------------
with tab_rules:
    st.markdown("### 📜 Rule Table Exporter")
    if df.empty:
        st.info("Load data to export rules.")
    else:
        reg_vars = st.multiselect("Regime fields", options=["btc_prev_ret","btc_prev_vol","btc_overnight_ret","open_gap_z","liq_median"], default=["btc_prev_ret","btc_overnight_ret"], key="rule_regime_fields")
        bins = st.slider("Bins per field", min_value=2, max_value=7, value=5, key="rule_bins")
        min_support = st.number_input("Min support (days)", min_value=1, value=10, step=1)
        min_sharpe = st.number_input("Min Sharpe", value=0.0, step=0.1)

        base = df.copy()
        key_cols = []
        for rv in reg_vars:
            col = f"{rv}_bin"
            base[col] = regime_bins(base[rv], bins=bins)
            key_cols.append(col)

        g = base.groupby(key_cols + ["method","buy_pct","sell_pct"], as_index=False).agg(
            avg_ret=("day_return","mean"),
            sharpe=("day_return", lambda x: float(np.nanmean(x)/np.nanstd(x)) if np.nanstd(x) else 0.0),
            support=("day_return","size")
        )
        # filter by constraints
        g = g[(g["support"] >= min_support) & (g["sharpe"] >= min_sharpe)]
        best = g.sort_values(["avg_ret","sharpe","support"], ascending=[False,False,False]).groupby(key_cols, as_index=False).head(1)
        st.dataframe(best, use_container_width=True)
        csv = best.to_csv(index=False).encode("utf-8")
        st.download_button("Download Rule Table CSV", csv, file_name="bitcorr_rule_table.csv", mime="text/csv")

# -----------------------------
# Constrained Policies (ROI)
# -----------------------------
with tab_constrained:
    st.markdown("### 🧪 Constrained Policies (ROI Backtest)")
    if df.empty:
        st.info("Load data to backtest policies.")
    else:
        start_capital = st.number_input("Start capital", value=10000.0, step=500.0)
        train_win = st.number_input("Training window (days)", min_value=20, max_value=250, value=60, step=5, key="constrained_train_win")
        reg_vars = st.multiselect("Regime fields", options=["btc_prev_ret","btc_prev_vol","btc_overnight_ret","open_gap_z"], default=["btc_prev_ret","btc_overnight_ret"], key="constrained_regime_fields")
        bins = st.slider("Bins per field", min_value=2, max_value=7, value=5, key="constrained_bins")
        # Constraints
        conf_h = st.selectbox("Confidence horizon for gating", options=[10,5,15,0], index=0, key="constrained_conf_h")
        conf_min = st.number_input("Trade only if confidence ≥", value=90.0, step=1.0)
        min_support = st.number_input("Min support per regime-action in training", min_value=1, value=10, step=1)

        conf_col = {0:"confidence_0m",5:"confidence_5m",10:"confidence_10m",15:"confidence_15m"}[conf_h]

        base = df.copy().sort_values("et_date")
        for rv in reg_vars:
            base[f"{rv}_bin"] = regime_bins(base[rv], bins=bins)

        dlist = sorted(base["et_date"].unique().tolist())
        out = []
        for i in range(int(train_win), len(dlist)):
            train_days = dlist[i-int(train_win):i]
            test_day = dlist[i]

            train = base[base["et_date"].isin(train_days)]
            g = train.groupby([*(f"{rv}_bin" for rv in reg_vars), "method","buy_pct","sell_pct"], as_index=False).agg(
                avg_ret=("day_return","mean"),
                support=("day_return","size"),
                mean_conf=(conf_col,"mean")
            )
            # Apply constraints
            g = g[(g["support"] >= int(min_support)) & (g["mean_conf"] >= float(conf_min))]
            if g.empty:
                out.append((test_day, np.nan)); continue

            best = g.sort_values(["avg_ret","support","mean_conf"], ascending=[False,False,False]).groupby([*(f"{rv}_bin" for rv in reg_vars)], as_index=False).head(1)

            # Determine today's bins (mode per bin)
            day_reg = base[base["et_date"] == test_day]
            if day_reg.empty:
                out.append((test_day, np.nan)); continue
            reg_key = []
            missing = False
            for rv in reg_vars:
                col = f"{rv}_bin"
                if day_reg[col].dropna().empty:
                    missing = True; break
                reg_key.append(int(day_reg[col].dropna().mode().iloc[0]))
            if missing:
                out.append((test_day, np.nan)); continue

            filt = best.copy()
            for j, rv in enumerate(reg_vars):
                filt = filt[filt[f"{rv}_bin"] == reg_key[j]]
            if filt.empty:
                out.append((test_day, np.nan)); continue

            act = filt.iloc[0]
            sel = base[(base["et_date"] == test_day) &
                       (base["method"] == act["method"]) &
                       (base["buy_pct"] == act["buy_pct"]) &
                       (base["sell_pct"] == act["sell_pct"])]
            out.append((test_day, float(sel["day_return"].mean()) if not sel.empty else np.nan))

        by_day = pd.DataFrame(out, columns=["et_date","day_return"]).dropna()
        eq = equity_from_returns(by_day["day_return"], start_capital)
        fig, ax = plt.subplots()
        ax.plot(by_day["et_date"], eq)
        ax.set_title("Constrained Walk-forward Adaptive equity")
        ax.set_xlabel("Date"); ax.set_ylabel("Equity"); ax.grid(True, alpha=0.2)
        st.pyplot(fig, use_container_width=True)
        st.dataframe(by_day, use_container_width=True)

# -----------------------------
# Transaction Costs modeling
# -----------------------------
with tab_tc:
    st.markdown("### 💸 Transaction-Cost Modeling (approx)")
    st.caption("Applies a simple per-trade and per-bps cost to day_return using n_trades and a capital base assumption. Use for sensitivity only.")
    if df.empty:
        st.info("Load data to model costs.")
    else:
        capital_base = st.number_input("Capital base (per symbol per day)", value=10000.0, step=500.0)
        commission_per_trade = st.number_input("Commission $ per trade", value=0.00, step=0.01)
        spread_bps_per_trade = st.number_input("Effective spread (bps) per trade", value=1.0, step=0.5)
        extra_slippage_bps = st.number_input("Additional slippage (bps) per trade", value=0.0, step=0.5)

        # Choose method & thresholds to view
        c = st.columns(3)
        with c[0]:
            m = st.selectbox("Method", options=sorted(df["method"].unique().tolist()))
        with c[1]:
            b = st.selectbox("Buy%", options=sorted(df["buy_pct"].unique().tolist()))
        with c[2]:
            s = st.selectbox("Sell%", options=sorted(df["sell_pct"].unique().tolist()))

        sub = df[(df["method"]==m) & (df["buy_pct"]==b) & (df["sell_pct"]==s)].sort_values("et_date")
        if sub.empty:
            st.info("No rows match selection.")
        else:
            # Costs as return decrement per day
            per_trade_return_cost = (commission_per_trade / float(capital_base)) + (spread_bps_per_trade + extra_slippage_bps)/10000.0
            adj_ret = sub["day_return"] - per_trade_return_cost * sub["n_trades"].astype(float)
            eq0 = equity_from_returns(sub["day_return"], 1.0)
            eq1 = equity_from_returns(adj_ret, 1.0)

            fig, ax = plt.subplots()
            ax.plot(sub["et_date"], eq0, label="No TC")
            ax.plot(sub["et_date"], eq1, label="With TC")
            ax.set_title("Equity with and without simple TC")
            ax.set_xlabel("Date"); ax.set_ylabel("Equity"); ax.grid(True, alpha=0.2)
            # No custom colors; using default styles. Add legend via basic handle.
            ax.legend()
            st.pyplot(fig, use_container_width=True)

# -----------------------------
# Live Policy Scorer
# -----------------------------
with tab_live:
    st.markdown("### 🧠 Live Policy Scorer")
    st.caption("Enter today's BTC context to fetch a recommended (method, buy%, sell%) from a rule table built on recent history.")
    if df.empty:
        st.info("Load data to build scoring rules.")
    else:
        # Build rule table on a trailing window (user picks)
        trail_days = st.number_input("Training window (days)", min_value=30, max_value=250, value=60, step=5, key="live_train_win")
        reg_vars = st.multiselect("Regime fields", options=["btc_prev_ret","btc_prev_vol","btc_overnight_ret","open_gap_z"], default=["btc_prev_ret","btc_overnight_ret"], key="live_regime_fields")
        bins = st.slider("Bins per field", min_value=2, max_value=7, value=5, key="live_bins")
        conf_h = st.selectbox("Confidence horizon for ranking", options=[10,5,15,0], index=0, key="live_conf_h")
        conf_col = {0:"confidence_0m",5:"confidence_5m",10:"confidence_10m",15:"confidence_15m"}[conf_h]
        min_support = st.number_input("Min support per regime-action", min_value=1, value=10, step=1)

        # Today's BTC context inputs
        st.markdown("**Enter today's BTC context:**")
        c = st.columns(4)
        with c[0]:
            btc_prev_ret = st.number_input("BTC prev day return (e.g. -0.03 = -3%)", value=0.0, step=0.01, format="%.4f")
        with c[1]:
            btc_prev_vol = st.number_input("BTC prev day vol (proxied)", value=0.02, step=0.005, format="%.4f")
        with c[2]:
            btc_overnight_ret = st.number_input("BTC overnight return", value=0.0, step=0.01, format="%.4f")
        with c[3]:
            open_gap_z = st.number_input("Open gap z", value=0.0, step=0.25, format="%.2f")

        # Build rule table on trailing window
        base = df.copy().sort_values("et_date")
        dlist = sorted(base["et_date"].unique().tolist())
        if len(dlist) <= trail_days:
            st.warning("Not enough days for the trailing window."); 
        else:
            use_days = set(dlist[-int(trail_days):])
            train = base[base["et_date"].isin(use_days)].copy()

            # Bin regimes using training sample edges
            key_cols = []
            for rv in reg_vars:
                col = f"{rv}_bin"
                train[col] = regime_bins(train[rv], bins=bins)
                key_cols.append(col)

            g = train.groupby(key_cols + ["method","buy_pct","sell_pct"], as_index=False).agg(
                avg_ret=("day_return","mean"),
                support=("day_return","size"),
                conf=("day_return", "size")
            )
            # join mean confidence per action
            g2 = train.groupby(key_cols + ["method","buy_pct","sell_pct"], as_index=False).agg(
                mean_conf=(conf_col,"mean")
            )
            g = g.merge(g2, on=key_cols + ["method","buy_pct","sell_pct"], how="left")
            g = g[(g["support"] >= int(min_support))]
            if g.empty:
                st.info("No rules meet support constraint in training window.")
            else:
                best = g.sort_values(["avg_ret","mean_conf","support"], ascending=[False,False,False]).groupby(key_cols, as_index=False).head(1)

                # Map today's numeric inputs to training bins by quantiles (approx: use training distributions)
                today = {"btc_prev_ret": btc_prev_ret, "btc_prev_vol": btc_prev_vol,
                         "btc_overnight_ret": btc_overnight_ret, "open_gap_z": open_gap_z}
                # Build quantiles from training
                bin_edges = {}
                for rv in reg_vars:
                    s = train[rv].replace([np.inf,-np.inf], np.nan).dropna()
                    if s.empty:
                        bin_edges[rv] = None
                    else:
                        qs = np.nanpercentile(s, np.linspace(0, 100, bins+1))
                        bin_edges[rv] = qs
                # Assign today's values to bins
                today_bins = {}
                for rv in reg_vars:
                    edges = bin_edges.get(rv)
                    val = today[rv]
                    if edges is None:
                        today_bins[rv] = None
                    else:
                        b = np.searchsorted(edges, val, side="right") - 1
                        b = max(0, min(b, bins-1))
                        today_bins[rv] = int(b)

                # Lookup best action
                filt = best.copy()
                for rv in reg_vars:
                    col = f"{rv}_bin"
                    b = today_bins.get(rv)
                    if b is None:
                        # no bin info => cannot score
                        filt = filt.iloc[0:0]
                        break
                    filt = filt[filt[col] == b]
                if filt.empty:
                    st.warning("No matching rule for today's context (given constraints). Try relaxing support/conf thresholds.")
                else:
                    act = filt.iloc[0]
                    st.success(f"**Suggested action:** method={act['method']}, buy={act['buy_pct']:.3f}%, sell={act['sell_pct']:.3f}%")
                    st.write("Source rule row:")
                    st.dataframe(filt.head(1), use_container_width=True)
