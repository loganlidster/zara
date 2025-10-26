
# bitcorr_analyzer_core.py
# Streamlit app for analyzing SQL-warehouse results of BitCorr (daily actions) - Core fast version.
# v2: Two-layer caching (raw load + in-memory filters) and a new "Confidence ROI Compare" tab.
import os
from datetime import date, timedelta
from typing import List, Tuple

import numpy as np
import pandas as pd
import pyodbc
import streamlit as st
import matplotlib.pyplot as plt

st.set_page_config(page_title="BitCorr Analyzer — Core", layout="wide")

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
# Sidebar: connection + filters
# -----------------------------
with st.sidebar:
    st.header("🔌 Connection")
    server = st.text_input("SQL Server", value=os.getenv("BITCORR_SQL_SERVER", "LLDT\\SQLEXPRESS"))
    database = st.text_input("Database", value=os.getenv("BITCORR_SQL_DB", "streamlit"))
    user_id = st.text_input("User tag (user_id)", value=os.getenv("BITCORR_USER_ID", "default"))

    st.divider()
    st.header("📅 Filters")

    # Discover date bounds
    try:
        meta_df = pd_read_sql(
            "SELECT MIN(et_date) AS min_d, MAX(et_date) AS max_d FROM dbo.bitcorr_daily_actions WITH (NOLOCK) WHERE user_id = ?;",
            server, database, params=(user_id,)
        )
        min_d = pd.to_datetime(meta_df["min_d"].iloc[0]).date() if not meta_df.empty else date.today() - timedelta(days=365)
        max_d = pd.to_datetime(meta_df["max_d"].iloc[0]).date() if not meta_df.empty else date.today()
    except Exception:
        min_d = date.today() - timedelta(days=365)
        max_d = date.today()

    d0 = st.date_input("Start date (ET)", value=max(min_d, max_d - timedelta(days=365)))
    d1 = st.date_input("End date (ET)", value=max_d)

    sessions = st.multiselect("Sessions", options=["RTH", "AH", "ALL", "CUSTOM"], default=["RTH","AH"])

    # Symbols list
    try:
        sym_df = pd_read_sql(
            "SELECT DISTINCT symbol FROM dbo.bitcorr_daily_actions WITH (NOLOCK) WHERE user_id = ? ORDER BY symbol;",
            server, database, params=(user_id,)
        )
        symbols_all = sorted(sym_df["symbol"].dropna().astype(str).tolist())
    except Exception:
        symbols_all = []
    symbols = st.multiselect("Symbols", options=symbols_all, default=symbols_all[:6] if symbols_all else [])

    # Methods available
    try:
        meth_df = pd_read_sql(
            "SELECT DISTINCT method FROM dbo.bitcorr_daily_actions WITH (NOLOCK) WHERE user_id = ? ORDER BY method;",
            server, database, params=(user_id,)
        )
        methods_all = sorted(meth_df["method"].dropna().astype(str).tolist())
    except Exception:
        methods_all = []
    methods = st.multiselect("Baseline Methods", options=methods_all, default=methods_all)

    st.caption("Tip: Narrow filters if queries become too large.")

    st.divider()
    st.header("⚙️ Thresholds (optional)")
    col_thr = st.columns(2)
    with col_thr[0]:
        buy_min = st.number_input("Buy% min", value=0.1, step=0.1, min_value=0.0)
        buy_max = st.number_input("Buy% max", value=3.0, step=0.1, min_value=0.0)
    with col_thr[1]:
        sell_min = st.number_input("Sell% min", value=0.1, step=0.1, min_value=0.0)
        sell_max = st.number_input("Sell% max", value=3.0, step=0.1, min_value=0.0)

    st.divider()
    st.header("📈 Confidence horizon")
    default_conf_h = st.selectbox("Default horizon (used for summaries)",
                                  options=[10,5,15,0], index=0, key="core_default_conf_h")

# -----------------------------
# Data loader (Two-layer caching)
# -----------------------------
@st.cache_data(show_spinner=True, ttl=600)
def load_raw_actions(server: str, db: str, user_id: str, d0: date, d1: date) -> pd.DataFrame:
    """Load a broader slice only by date + user. Downstream filters are applied in memory for speed."""
    q = """
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
    WHERE user_id = ? AND et_date BETWEEN ? AND ?;
    """
    df = pd_read_sql(q, server, db, params=(user_id, str(d0), str(d1)))
    if not df.empty:
        df["et_date"] = pd.to_datetime(df["et_date"]).dt.date
        for c in ["buy_pct","sell_pct","day_return","baseline",
                  "corr_pearson","corr_spearman","confidence",
                  "corr_pearson_0m","corr_spearman_0m","confidence_0m",
                  "corr_pearson_5m","corr_spearman_5m","confidence_5m",
                  "corr_pearson_10m","corr_spearman_10m","confidence_10m",
                  "corr_pearson_15m","corr_spearman_15m","confidence_15m",
                  "btc_prev_ret","btc_prev_vol","btc_prev_range","btc_overnight_ret",
                  "open_gap_z","liq_median","liq_p10","liq_p90"]:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")
        if "n_trades" in df.columns:
            df["n_trades"] = pd.to_numeric(df["n_trades"], errors="coerce").fillna(0).astype(int)
        df["symbol"] = df["symbol"].astype(str)
        df["session"] = df["session"].astype(str)
        df["method"] = df["method"].astype(str)
    return df

def filter_actions(raw: pd.DataFrame,
                   symbols: List[str], sessions: List[str], methods: List[str],
                   buy_min: float, buy_max: float, sell_min: float, sell_max: float) -> pd.DataFrame:
    if raw is None or raw.empty:
        return pd.DataFrame()
    sub = raw
    if symbols:
        sub = sub[sub["symbol"].isin(symbols)]
    if sessions:
        sub = sub[sub["session"].isin(sessions)]
    if methods:
        sub = sub[sub["method"].isin(methods)]
    sub = sub[(sub["buy_pct"] >= float(buy_min)) & (sub["buy_pct"] <= float(buy_max))]
    sub = sub[(sub["sell_pct"] >= float(sell_min)) & (sub["sell_pct"] <= float(sell_max))]
    return sub

raw = load_raw_actions(server, database, user_id, d0, d1)
df = filter_actions(raw, symbols, sessions, methods, buy_min, buy_max, sell_min, sell_max)

# Guardrail for huge pulls
if raw is not None and len(raw) > 5_000_000:
    st.warning(f"Raw dataset has {len(raw):,} rows for this date span. Narrow date range for faster interactivity.")
if df is not None and len(df) > 5_000_000:
    st.warning(f"Filtered dataset has {len(df):,} rows. Consider narrowing symbols/methods/thresholds.")

# -----------------------------
# Helpers
# -----------------------------
def equity_from_returns(ret, start_capital: float = 1.0) -> pd.Series:
    # Ensure pandas Series
    ret = pd.Series(ret)
    eq = (1.0 + ret.fillna(0.0)).cumprod() * start_capital
    return eq

def sharpe_like(x: pd.Series) -> float:
    m = np.nanmean(x); s = np.nanstd(x)
    return float(m / s) if s and np.isfinite(s) else 0.0

def pick_conf_cols(h: int) -> Tuple[str,str,str]:
    if h == 0: return "corr_pearson_0m","corr_spearman_0m","confidence_0m"
    if h == 5: return "corr_pearson_5m","corr_spearman_5m","confidence_5m"
    if h == 10: return "corr_pearson_10m","corr_spearman_10m","confidence_10m"
    if h == 15: return "corr_pearson_15m","corr_spearman_15m","confidence_15m"
    return "corr_pearson_10m","corr_spearman_10m","confidence_10m"

def regime_bins(x: pd.Series, how: str = "quantile", bins: int = 5) -> pd.Series:
    x = x.replace([np.inf, -np.inf], np.nan)
    if how == "quantile":
        try:
            return pd.qcut(x, q=bins, labels=False, duplicates="drop")
        except Exception:
            return pd.Series(np.full(len(x), np.nan))
    elif how == "std":
        mu, sd = np.nanmean(x), np.nanstd(x)
        edges = [mu + sd * k for k in [-2,-1,0,1,2,3]]
        return pd.cut(x, bins=edges, labels=False, include_lowest=True)
    else:
        return pd.Series(np.full(len(x), np.nan))

@st.cache_data
def compute_heatmap(df: pd.DataFrame, method_pick: str|None):
    sub = df if (method_pick in (None, "<ALL>")) else df[df["method"] == method_pick]
    pivot = sub.pivot_table(index="buy_pct", columns="sell_pct", values="day_return", aggfunc="mean")
    return pivot.sort_index().sort_index(axis=1)

@st.cache_data
def run_walkforward(base: pd.DataFrame, reg_vars: List[str], train_win: int, bins: int, start_capital: float) -> Tuple[pd.DataFrame, pd.Series]:
    key_cols = [f"{rv}_bin" for rv in reg_vars]
    base = base.copy()
    for rv in reg_vars:
        base[f"{rv}_bin"] = pd.qcut(base[rv], q=bins, labels=False, duplicates="drop")
    base = base.sort_values("et_date")
    dlist = sorted(base["et_date"].unique().tolist())
    out = []
    for i in range(int(train_win), len(dlist)):
        train_days = dlist[i-int(train_win):i]
        test_day = dlist[i]

        train = base[base["et_date"].isin(train_days)]
        g = train.groupby(key_cols + ["method","buy_pct","sell_pct"], as_index=False).agg(
            avg_ret=("day_return","mean"),
            support=("day_return","size")
        )
        best = g.sort_values(["avg_ret","support"], ascending=[False,False]).groupby(key_cols, as_index=False).head(1)

        day_reg = base[base["et_date"] == test_day]
        if day_reg.empty:
            out.append((test_day, np.nan)); continue
        reg_key = [int(pd.Series(day_reg[k].dropna()).mode().iloc[0]) if not day_reg[k].dropna().empty else np.nan for k in key_cols]
        if any(pd.isna(reg_key)):
            out.append((test_day, np.nan)); continue
        filt = best.copy()
        for j, k in enumerate(key_cols):
            filt = filt[filt[k] == reg_key[j]]
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
    return by_day, eq

# -----------------------------
# Tabs
# -----------------------------
tab_overview, tab_regimes, tab_winners, tab_heatmap, tab_thresholds, tab_conf, tab_confroi, tab_policy, tab_export, tab_runlog = st.tabs([
    "Overview", "Regime Explorer", "Daily Winners", "Heatmap (Buy×Sell)", "Fixed-Threshold Compare",
    "Confidence Explorer", "Confidence ROI Compare", "Policy ROI (Backtest)", "Export", "Run Log"
])

# -----------------------------
# Overview
# -----------------------------
with tab_overview:
    st.markdown("### 📊 Overview")
    if df.empty:
        st.info("No data for selected filters. Adjust the sidebar and try again.")
    else:
        col = st.columns(4)
        with col[0]:
            st.metric("Rows (filtered)", f"{len(df):,}")
        with col[1]:
            days = df["et_date"].nunique()
            st.metric("Days", f"{days:,}")
        with col[2]:
            sym_ct = df["symbol"].nunique()
            st.metric("Symbols", f"{sym_ct:,}")
        with col[3]:
            meth_ct = df["method"].nunique()
            st.metric("Methods", f"{meth_ct:,}")

        # Aggregate best per method overall
        agg = df.groupby(["symbol","session","method"], as_index=False).agg(
            mean_return=("day_return","mean"),
            sharpe=("day_return", sharpe_like),
            days=("et_date","nunique")
        ).sort_values("mean_return", ascending=False).head(20)
        st.markdown("**Top methods by mean return**")
        st.dataframe(agg, use_container_width=True)

        # Oracle equity (best per day across all combos per symbol) averaged across symbols
        oracle = df.sort_values(["symbol","session","et_date","day_return"], ascending=[True,True,True,False]).drop_duplicates(["symbol","session","et_date"])
        eq_oracle = oracle.groupby("et_date")["day_return"].mean().sort_index()
        eq_df = pd.DataFrame({"et_date": eq_oracle.index, "oracle_ret": eq_oracle.values})
        eq_df["oracle_eq"] = equity_from_returns(eq_df["oracle_ret"], 1.0)

        fig, ax = plt.subplots()
        ax.plot(eq_df["et_date"], eq_df["oracle_eq"])
        ax.set_title("Oracle equity (mean of per-symbol daily winners)")
        ax.set_xlabel("Date")
        ax.set_ylabel("Equity (start=1.0)")
        ax.grid(True, alpha=0.2)
        st.pyplot(fig, use_container_width=True)

# -----------------------------
# Regime Explorer
# -----------------------------
with tab_regimes:
    st.markdown("### 🧭 Regime Explorer")
    if df.empty:
        st.info("Load data in the sidebar to explore regimes.")
    else:
        # Choose regime variables
        reg_vars = st.multiselect("Regime variables", options=[
            "btc_prev_ret","btc_prev_vol","btc_overnight_ret","open_gap_z","liq_median"
        ], default=["btc_prev_ret","btc_overnight_ret"])
        n_bins = st.slider("Number of bins (quantiles)", min_value=2, max_value=7, value=5)

        work = df.copy()
        bucket_names = []
        for rv in reg_vars:
            b = regime_bins(work[rv], how="quantile", bins=n_bins)
            col = f"{rv}_bin"
            work[col] = b
            bucket_names.append(col)
        if not bucket_names:
            st.warning("Select at least one regime variable.")
        else:
            group_keys = bucket_names + ["method","buy_pct","sell_pct"]
            g = work.groupby(group_keys, as_index=False).agg(
                avg_ret=("day_return","mean"),
                support=("day_return","size"),
                sharpe=("day_return", lambda x: float(np.nanmean(x)/np.nanstd(x)) if np.nanstd(x) else 0.0),
                conf10=("confidence_10m","mean")
            )
            # For each regime bucket, pick best action
            sort = g.sort_values(["avg_ret","sharpe","support"], ascending=[False,False,False])
            best = sort.groupby(bucket_names, as_index=False).head(1)
            st.markdown("**Best action per regime bucket**")
            st.dataframe(best, use_container_width=True)

            # Heatmap for a selected regime bucket
            st.markdown("**Heatmap: Buy×Sell average return for a selected regime bucket**")
            if all(work[bn].notna().any() for bn in bucket_names):
                pick = {}
                pick_cols = st.columns(len(bucket_names))
                for i, bn in enumerate(bucket_names):
                    with pick_cols[i]:
                        pick[bn] = st.selectbox(bn, sorted([int(x) for x in work[bn].dropna().unique()]))
                sub = work.copy()
                mask = np.ones(len(sub), dtype=bool)
                for bn, val in pick.items():
                    mask &= (sub[bn].astype(float) == float(val))
                sub = sub[mask]
                if sub.empty:
                    st.info("No rows for selected bucket.")
                else:
                    pivot = compute_heatmap(sub, method_pick=None)
                    fig2, ax2 = plt.subplots()
                    im = ax2.imshow(pivot.values, aspect="auto", origin="lower")
                    ax2.set_xticks(range(pivot.shape[1]))
                    ax2.set_xticklabels([f"{c:.1f}" for c in pivot.columns], rotation=90)
                    ax2.set_yticks(range(pivot.shape[0]))
                    ax2.set_yticklabels([f"{i:.1f}" for i in pivot.index])
                    ax2.set_xlabel("Sell %")
                    ax2.set_ylabel("Buy %")
                    ax2.set_title("Mean day_return")
                    fig2.colorbar(im, ax=ax2, fraction=0.046, pad=0.02)
                    st.pyplot(fig2, use_container_width=True)
            else:
                st.caption("No valid buckets to select.")

# -----------------------------
# Daily Winners
# -----------------------------
with tab_winners:
    st.markdown("### 🏆 Daily Winners")
    if df.empty:
        st.info("Load data to see winners.")
    else:
        winners = df.sort_values(["symbol","session","et_date","day_return"], ascending=[True,True,True,False]).drop_duplicates(["symbol","session","et_date"])
        st.dataframe(winners[["symbol","session","et_date","method","buy_pct","sell_pct","day_return"]].sort_values(["et_date","symbol"]), use_container_width=True)

        # Win rate by method
        win_rate = winners.groupby("method", as_index=False).agg(
            wins=("et_date","count"),
            avg_ret=("day_return","mean")
        ).sort_values("wins", ascending=False)
        st.markdown("**Win count by method**")
        st.dataframe(win_rate, use_container_width=True)

        # Timeline chart: average winner return per day (across symbols)
        series = winners.groupby("et_date")["day_return"].mean().sort_index()
        fig3, ax3 = plt.subplots()
        ax3.plot(series.index, (1.0 + series).cumprod())
        ax3.set_title("Equity of daily winners (avg across symbols)")
        ax3.set_xlabel("Date")
        ax3.set_ylabel("Equity (start=1.0)")
        ax3.grid(True, alpha=0.2)
        st.pyplot(fig3, use_container_width=True)

# -----------------------------
# Heatmap (Buy×Sell)
# -----------------------------
with tab_heatmap:
    st.markdown("### 🧯 Heatmap: mean return by Buy×Sell")
    if df.empty:
        st.info("Load data to see heatmaps.")
    else:
        # Optionally filter to one method for clarity
        meth_pick = st.selectbox("Method (optional)", options=["<ALL>"] + sorted(df["method"].unique().tolist()))
        pivot = compute_heatmap(df, meth_pick)
        fig4, ax4 = plt.subplots()
        im = ax4.imshow(pivot.values, aspect="auto", origin="lower")
        ax4.set_xticks(range(pivot.shape[1]))
        ax4.set_xticklabels([f"{c:.1f}" for c in pivot.columns], rotation=90)
        ax4.set_yticks(range(pivot.shape[0]))
        ax4.set_yticklabels([f"{i:.1f}" for i in pivot.index])
        ax4.set_xlabel("Sell %")
        ax4.set_ylabel("Buy %")
        ax4.set_title("Mean day_return")
        fig4.colorbar(im, ax=ax4, fraction=0.046, pad=0.02)
        st.pyplot(fig4, use_container_width=True)

# -----------------------------
# Fixed-Threshold Compare
# -----------------------------
with tab_thresholds:
    st.markdown("### 🎛️ Fixed-Threshold Comparison")
    if df.empty:
        st.info("Load data to compare thresholds.")
    else:
        c = st.columns(3)
        with c[0]:
            bsel = st.selectbox("Buy% (exact)", options=sorted(df["buy_pct"].unique().tolist()))
        with c[1]:
            ssel = st.selectbox("Sell% (exact)", options=sorted(df["sell_pct"].unique().tolist()))
        with c[2]:
            metric = st.selectbox("Metric", options=["mean_return","sharpe","support"], index=0)
        ft = df[(df["buy_pct"].round(3) == round(float(bsel),3)) & (df["sell_pct"].round(3) == round(float(ssel),3))]
        if ft.empty:
            st.info("No rows match that exact threshold pair in the filtered data.")
        else:
            comp = ft.groupby(["method"], as_index=False).agg(
                mean_return=("day_return","mean"),
                sharpe=("day_return", sharpe_like),
                support=("day_return","size"),
                conf10=("confidence_10m","mean")
            ).sort_values(metric, ascending=False)
            st.dataframe(comp, use_container_width=True)

# -----------------------------
# Confidence Explorer
# -----------------------------
with tab_conf:
    st.markdown("### 🔬 Confidence Explorer")
    if df.empty:
        st.info("Load data to explore confidence.")
    else:
        conf_col = {0:"confidence_0m",5:"confidence_5m",10:"confidence_10m",15:"confidence_15m"}[default_conf_h]
        cols = st.columns(2)
        with cols[0]:
            view = df[[conf_col,"day_return"]].dropna()
            if len(view) > 100000:
                view = view.sample(100000, random_state=42)
            fig5, ax5 = plt.subplots()
            ax5.scatter(view[conf_col], view["day_return"], s=2, alpha=0.3)
            ax5.set_xlabel("Confidence")
            ax5.set_ylabel("Day return")
            ax5.set_title(f"Confidence ({default_conf_h}m) vs Day return")
            ax5.grid(True, alpha=0.2)
            st.pyplot(fig5, use_container_width=True)
        with cols[1]:
            # Correlation summary by method
            def corr_with_conf(sub):
                s = sub[conf_col].fillna(0.0)
                r = sub["day_return"].fillna(0.0)
                if len(s) < 3:
                    return np.nan
                try:
                    return float(np.corrcoef(s, r)[0, 1])
                except Exception:
                    return np.nan
            csum = df.groupby("method").apply(corr_with_conf).reset_index(name="corr_conf_ret")
            csum2 = df.groupby("method", as_index=False).agg(
                mean_conf=(conf_col,"mean"),
                mean_ret=("day_return","mean"),
                support=("day_return","size")
            )
            csum = csum.merge(csum2, on="method", how="inner").sort_values("mean_ret", ascending=False)
            st.dataframe(csum, use_container_width=True)

# -----------------------------
# Confidence ROI Compare
# -----------------------------
with tab_confroi:
    st.markdown("### 🧪 Confidence ROI Compare (by horizon)")
    if df.empty:
        st.info("Load data to compare ROI across confidence horizons.")
    else:
        st.caption("Pick one method + threshold pair. We'll plot equity for: No gate, and confidence gates at 0m/5m/10m/15m ≥ min score.")
        c = st.columns(4)
        with c[0]:
            method_pick = st.selectbox("Method", options=sorted(df["method"].unique().tolist()), key="confroi_method")
        with c[1]:
            buy_pick = st.selectbox("Buy% (exact)", options=sorted(df["buy_pct"].unique().tolist()), key="confroi_buy")
        with c[2]:
            sell_pick = st.selectbox("Sell% (exact)", options=sorted(df["sell_pct"].unique().tolist()), key="confroi_sell")
        with c[3]:
            min_conf = st.slider("Min confidence (gate)", min_value=0, max_value=100, value=90, step=1, key="confroi_min_conf")

        base = df[(df["method"]==method_pick) & (df["buy_pct"]==buy_pick) & (df["sell_pct"]==sell_pick)].copy()
        if base.empty:
            st.info("No rows match that method/threshold pair in the filtered data.")
        else:
            # Build a full day index
            all_days = pd.Series(sorted(df["et_date"].unique()))
            def series_for_gate(df_sub: pd.DataFrame, conf_col: str|None, gate: int|None) -> pd.Series:
                if conf_col and gate is not None:
                    sub = df_sub[df_sub[conf_col] >= float(gate)]
                else:
                    sub = df_sub
                # avg across symbols/sessions per day
                by_day = sub.groupby("et_date")["day_return"].mean()
                # reindex to all days; fill with 0 for skip/no-trade day
                by_day = by_day.reindex(all_days, fill_value=0.0)
                return by_day

            # Build curves
            curves = {}
            curves["No gate"] = series_for_gate(base, None, None)

            for H in [0,5,10,15]:
                conf_col = {0:"confidence_0m",5:"confidence_5m",10:"confidence_10m",15:"confidence_15m"}[H]
                label = f"{H}m ≥ {min_conf}"
                curves[label] = series_for_gate(base, conf_col, min_conf)

            # Plot
            fig, ax = plt.subplots()
            for label, s in curves.items():
                ax.plot(all_days, equity_from_returns(s, 1.0), label=label)
            ax.set_title("Equity vs Confidence horizon")
            ax.set_xlabel("Date"); ax.set_ylabel("Equity (start=1.0)"); ax.grid(True, alpha=0.2)
            ax.legend()
            st.pyplot(fig, use_container_width=True)

            # Summary stats
            rows = []
            for label, s in curves.items():
                eq = equity_from_returns(s, 1.0)
                total_ret = float(eq.iloc[-1] - 1.0) if len(eq) else 0.0
                rows.append({
                    "scenario": label,
                    "mean_day_ret": float(np.nanmean(s)),
                    "std_day_ret": float(np.nanstd(s)),
                    "sharpe_like": float(np.nanmean(s)/np.nanstd(s)) if np.nanstd(s) else 0.0,
                    "total_return": total_ret
                })
            st.dataframe(pd.DataFrame(rows).sort_values("total_return", ascending=False), use_container_width=True)

# -----------------------------
# Policy ROI (Backtest) - core
# -----------------------------
with tab_policy:
    st.markdown("### 🧪 Policy ROI Backtest (Core)")
    if df.empty:
        st.info("Load data to backtest policies.")
    else:
        st.markdown("**Policy type**")
        policy_type = st.selectbox("Select", options=["Static (fixed method+thresholds)","Adaptive (in-sample)","Walk-forward Adaptive"], index=2)
        start_capital = st.number_input("Start capital", value=10000.0, step=1000.0, key="policy_start_cap")
        train_win = st.number_input("Training window (days)", min_value=20, max_value=250, value=60, step=5, key="policy_train_win")

        # Regime fields for adaptive
        reg_vars = st.multiselect("Regime fields", options=["btc_prev_ret","btc_prev_vol","btc_overnight_ret","open_gap_z"], default=["btc_prev_ret","btc_overnight_ret"], key="policy_reg_fields")
        bins = st.slider("Bins per regime field", min_value=2, max_value=7, value=5, key="policy_bins")

        # Static params
        c2 = st.columns(3)
        with c2[0]:
            static_method = st.selectbox("Static: method", options=sorted(df["method"].unique().tolist()), key="policy_static_method")
        with c2[1]:
            static_buy = st.selectbox("Static: buy%", options=sorted(df["buy_pct"].unique().tolist()), key="policy_static_buy")
        with c2[2]:
            static_sell = st.selectbox("Static: sell%", options=sorted(df["sell_pct"].unique().tolist()), key="policy_static_sell")

        base = df.copy()
        # Bin regimes
        for rv in reg_vars:
            base[f"{rv}_bin"] = pd.qcut(base[rv], q=bins, labels=False, duplicates="drop")

        if policy_type == "Static (fixed method+thresholds)":
            static_rows = base[(base["method"] == static_method) & (base["buy_pct"] == static_buy) & (base["sell_pct"] == static_sell)]
            by_day = static_rows.groupby("et_date", as_index=False)["day_return"].mean()
            eq = equity_from_returns(by_day["day_return"], start_capital)
            fig6, ax6 = plt.subplots()
            ax6.plot(by_day["et_date"], eq)
            ax6.set_title("Static policy equity")
            ax6.set_xlabel("Date"); ax6.set_ylabel("Equity")
            ax6.grid(True, alpha=0.2)
            st.pyplot(fig6, use_container_width=True)
            st.dataframe(by_day, use_container_width=True)

        elif policy_type == "Adaptive (in-sample)":
            key_cols = [f"{rv}_bin" for rv in reg_vars]
            g = base.groupby(key_cols + ["method","buy_pct","sell_pct"], as_index=False).agg(
                avg_ret=("day_return","mean"),
                support=("day_return","size")
            )
            best = g.sort_values(["avg_ret","support"], ascending=[False,False]).groupby(key_cols, as_index=False).head(1)
            base_key = base.drop_duplicates(["et_date"] + key_cols)[["et_date"] + key_cols].sort_values("et_date")
            table = base_key.merge(best, on=key_cols, how="left")
            daily = []
            for _, row in table.iterrows():
                d = row["et_date"]
                sel = base[(base["et_date"] == d) &
                           (base["method"] == row["method"]) &
                           (base["buy_pct"] == row["buy_pct"]) &
                           (base["sell_pct"] == row["sell_pct"])]
                daily.append((d, float(sel["day_return"].mean()) if not sel.empty else np.nan))
            by_day = pd.DataFrame(daily, columns=["et_date","day_return"]).dropna()
            eq = equity_from_returns(by_day["day_return"], start_capital)
            fig7, ax7 = plt.subplots()
            ax7.plot(by_day["et_date"], eq)
            ax7.set_title("Adaptive policy (in-sample rule table)")
            ax7.set_xlabel("Date"); ax7.set_ylabel("Equity"); ax7.grid(True, alpha=0.2)
            st.pyplot(fig7, use_container_width=True)
            st.dataframe(by_day, use_container_width=True)

        else:  # Walk-forward
            key_cols = [f"{rv}_bin" for rv in reg_vars]
            by_day, eq = run_walkforward(base, reg_vars, int(train_win), int(bins), float(start_capital))
            fig8, ax8 = plt.subplots()
            ax8.plot(by_day["et_date"], eq)
            ax8.set_title("Walk-forward Adaptive equity")
            ax8.set_xlabel("Date"); ax8.set_ylabel("Equity"); ax8.grid(True, alpha=0.2)
            st.pyplot(fig8, use_container_width=True)
            st.dataframe(by_day, use_container_width=True)

# -----------------------------
# Export
# -----------------------------
with tab_export:
    st.markdown("### ⬇️ Export filtered dataset")
    if df.empty:
        st.info("No data to export. Adjust filters.")
    else:
        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button("Download CSV", csv, file_name="bitcorr_filtered.csv", mime="text/csv")

# -----------------------------
# Run Log
# -----------------------------
with tab_runlog:
    st.markdown("### 📜 Run Log (builder jobs)")
    try:
        log_df = pd_read_sql(
            """
            SELECT TOP 1000 id, started_utc, ended_utc, status, user_id, symbol, session, date_start, date_end,
                   expected_rows, existing_rows, inserted_rows, message
            FROM dbo.bitcorr_run_log WITH (NOLOCK)
            WHERE user_id = ?
            ORDER BY id DESC;
            """, server, database, params=(user_id,)
        )
        st.dataframe(log_df, use_container_width=True)
    except Exception as e:
        st.warning(f"Unable to read run log: {e}")
