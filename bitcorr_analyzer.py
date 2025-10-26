
# bitcorr_analyzer.py
# Streamlit app for analyzing SQL-warehouse results of BitCorr (daily actions).
# Focused on charts, heatmaps, winners, regimes, and backtests.
import os
import math
import json
from datetime import date, datetime, timedelta, time as dtime
from typing import Optional, List, Dict, Tuple

import numpy as np
import pandas as pd
import pyodbc
import streamlit as st
import matplotlib.pyplot as plt

st.set_page_config(page_title="BitCorr Analyzer", layout="wide")

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
    server = st.text_input("SQL Server", value=os.getenv("BITCORR_SQL_SERVER", "LLLDT\\SQLEXPRESS"))
    database = st.text_input("Database", value=os.getenv("BITCORR_SQL_DB", "streamlit"))
    user_id = st.text_input("User tag (user_id)", value=os.getenv("BITCORR_USER_ID", "default"))

    st.divider()
    st.header("📅 Filters")

    # Discover symbols & date bounds from warehouse
    try:
        meta_df = pd_read_sql(
            """
            SELECT MIN(et_date) AS min_d, MAX(et_date) AS max_d FROM dbo.bitcorr_daily_actions WHERE user_id = ?;
            """, server, database, params=(user_id,)
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
            "SELECT DISTINCT symbol FROM dbo.bitcorr_daily_actions WHERE user_id = ? ORDER BY symbol;",
            server, database, params=(user_id,)
        )
        symbols_all = sorted(sym_df["symbol"].dropna().astype(str).tolist())
    except Exception:
        symbols_all = []
    symbols = st.multiselect("Symbols", options=symbols_all, default=symbols_all[:6] if symbols_all else [])

    # Methods available
    try:
        meth_df = pd_read_sql(
            "SELECT DISTINCT method FROM dbo.bitcorr_daily_actions WHERE user_id = ? ORDER BY method;",
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
    st.header("📈 Confidence horizon used in default fields")
    default_conf_h = st.selectbox("Default confidence horizon (for legacy columns)",
                                  options=[10,5,15,0], index=0,
                                  help="Legacy columns corr_pearson/corr_spearman/confidence mirror this horizon for summaries.")

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
    # Ensure dtypes
    if not df.empty:
        df["et_date"] = pd.to_datetime(df["et_date"]).dt.date
        df["buy_pct"] = df["buy_pct"].astype(float)
        df["sell_pct"] = df["sell_pct"].astype(float)
        df["day_return"] = df["day_return"].astype(float)
        df["n_trades"] = df["n_trades"].astype(int)
    return df

df = load_actions(server, database, user_id, symbols, sessions, d0, d1, methods, buy_min, buy_max, sell_min, sell_max)

# Guardrail for huge pulls
if len(df) > 5_000_000:
    st.warning(f"Dataset has {len(df):,} rows. Consider narrowing filters for interactivity.")

# -----------------------------
# Helper computations
# -----------------------------
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

def sharpe_like(x: pd.Series) -> float:
    m = np.nanmean(x)
    s = np.nanstd(x)
    return float(m / s) if s and np.isfinite(s) else 0.0

def equity_from_returns(ret: pd.Series, start_capital: float = 1.0) -> pd.Series:
    eq = (1.0 + ret.fillna(0.0)).cumprod() * start_capital
    return eq

# -----------------------------
# Tabs
# -----------------------------
tab_overview, tab_regimes, tab_winners, tab_heatmap, tab_thresholds, tab_conf, tab_policy, tab_export, tab_runlog = st.tabs([
    "Overview", "Regime Explorer", "Daily Winners", "Heatmap (Buy×Sell)", "Fixed-Threshold Compare",
    "Confidence Explorer", "Policy ROI (Backtest)", "Export", "Run Log"
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
            st.metric("Rows", f"{len(df):,}")
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

        # Equity curve of simple policy: best-per-day (oracle) vs. equal-weight of methods (for a quick glance)
        # Oracle (best per day across all combos)
        oracle = df.sort_values(["et_date","day_return"], ascending=[True,False]).drop_duplicates(["symbol","session","et_date"])
        eq_oracle = oracle.groupby("et_date")["day_return"].mean().sort_index()
        eq_df = pd.DataFrame({
            "et_date": eq_oracle.index,
            "oracle_ret": eq_oracle.values
        })
        eq_df["oracle_eq"] = equity_from_returns(eq_df["oracle_ret"].values, 1.0)

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
                sharpe=("day_return", sharpe_like),
                conf10=("confidence_10m","mean")
            )
            # For each regime bucket, pick best action
            sort = g.sort_values(["avg_ret","sharpe","support"], ascending=[False,False,False])
            best = sort.groupby(bucket_names, as_index=False).head(1)
            st.markdown("**Best action per regime bucket**")
            st.dataframe(best, use_container_width=True)

            # Heatmap for a selected regime bucket
            st.markdown("**Heatmap: Buy×Sell average return for a selected regime bucket**")
            pick = {}
            pick_cols = st.columns(len(bucket_names))
            for i, bn in enumerate(bucket_names):
                with pick_cols[i]:
                    pick[bn] = st.selectbox(bn, sorted(work[bn].dropna().unique().astype(int).tolist()))
            sub = work.copy()
            mask = np.ones(len(sub), dtype=bool)
            for bn, val in pick.items():
                mask &= (sub[bn].astype(float) == float(val))
            sub = sub[mask]
            if sub.empty:
                st.info("No rows for selected bucket.")
            else:
                pivot = sub.pivot_table(index="buy_pct", columns="sell_pct", values="day_return", aggfunc="mean")
                pivot = pivot.sort_index().sort_index(axis=1)
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
        sub = df.copy()
        if meth_pick != "<ALL>":
            sub = sub[sub["method"] == meth_pick]
        pivot = sub.pivot_table(index="buy_pct", columns="sell_pct", values="day_return", aggfunc="mean")
        pivot = pivot.sort_index().sort_index(axis=1)
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
            bsel = st.number_input("Buy% (exact)", min_value=float(df["buy_pct"].min()), max_value=float(df["buy_pct"].max() or 3.0), value=float(df["buy_pct"].min()))
        with c[1]:
            ssel = st.number_input("Sell% (exact)", min_value=float(df["sell_pct"].min()), max_value=float(df["sell_pct"].max() or 3.0), value=float(df["sell_pct"].min()))
        with c[2]:
            metric = st.selectbox("Metric", options=["mean_return","sharpe","support"], index=0)
        ft = df[(df["buy_pct"].round(3) == round(bsel,3)) & (df["sell_pct"].round(3) == round(ssel,3))]
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
        pear_col, spear_col, conf_col = pick_conf_cols(default_conf_h)
        st.caption(f"Using {default_conf_h}m horizon: {pear_col}, {spear_col}, {conf_col}")
        cols = st.columns(2)
        with cols[0]:
            # Scatter sample (downsample if large)
            view = df[[conf_col,"day_return"]].dropna()
            if len(view) > 100000:
                view = view.sample(100000, random_state=42)
            fig5, ax5 = plt.subplots()
            ax5.scatter(view[conf_col], view["day_return"], s=2, alpha=0.3)
            ax5.set_xlabel("Confidence")
            ax5.set_ylabel("Day return")
            ax5.set_title("Confidence vs Day return")
            ax5.grid(True, alpha=0.2)
            st.pyplot(fig5, use_container_width=True)
        with cols[1]:
            # Correlation summary by method
            csum = df.groupby("method", as_index=False).agg(
                mean_conf=(conf_col,"mean"),
                corr_with_ret=("day_return", lambda x: np.corrcoef(x, df.loc[x.index, conf_col].fillna(0))[0,1] if len(x)>2 else np.nan),
                mean_ret=("day_return","mean"),
                support=("day_return","size")
            ).sort_values("mean_ret", ascending=False)
            st.dataframe(csum, use_container_width=True)

# -----------------------------
# Policy ROI (Backtest)
# -----------------------------
with tab_policy:
    st.markdown("### 🧪 Policy ROI Backtest")
    if df.empty:
        st.info("Load data to backtest policies.")
    else:
        st.markdown("**Policy type**")
        policy_type = st.selectbox("Select", options=["Static (fixed method+thresholds)","Adaptive (regime table, in-sample)","Walk-forward Adaptive"], index=2)
        start_capital = st.number_input("Start capital", value=10000.0, step=1000.0)
        train_win = st.number_input("Training window (days)", min_value=20, max_value=250, value=60, step=5)
        # Regime fields for adaptive
        reg_vars = st.multiselect("Regime fields", options=["btc_prev_ret","btc_prev_vol","btc_overnight_ret","open_gap_z"], default=["btc_prev_ret","btc_overnight_ret"])
        bins = st.slider("Bins per regime field", min_value=2, max_value=7, value=5)

        # Static params
        c2 = st.columns(3)
        with c2[0]:
            static_method = st.selectbox("Static: method", options=sorted(df["method"].unique().tolist()))
        with c2[1]:
            static_buy = st.selectbox("Static: buy%", options=sorted(df["buy_pct"].unique().tolist()))
        with c2[2]:
            static_sell = st.selectbox("Static: sell%", options=sorted(df["sell_pct"].unique().tolist()))

        # Prepare daily index across selected symbols/sessions
        # We'll average returns across symbols for the chosen action.
        base = df.copy()

        # Bin regimes
        for rv in reg_vars:
            base[f"{rv}_bin"] = regime_bins(base[rv], "quantile", bins)

        days = sorted(base["et_date"].unique().tolist())
        results = []

        if policy_type == "Static (fixed method+thresholds)":
            # For each day, pick rows that match method & thresholds; average across symbols/sessions
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

        elif policy_type == "Adaptive (regime table, in-sample)":
            # Build one rule table on the entire sample; then apply to all days (in-sample estimate).
            if not reg_vars:
                st.warning("Select at least one regime field.")
            else:
                key_cols = [f"{rv}_bin" for rv in reg_vars]
                g = base.groupby(key_cols + ["method","buy_pct","sell_pct"], as_index=False).agg(
                    avg_ret=("day_return","mean"),
                    support=("day_return","size")
                )
                # choose best per regime
                best = g.sort_values(["avg_ret","support"], ascending=[False,False]).groupby(key_cols, as_index=False).head(1)

                # Map each day to its regime key and pick that action
                base_key = base.drop_duplicates(["et_date"] + key_cols)[["et_date"] + key_cols].sort_values("et_date")
                def merge_best(bk, best):
                    # left-join using key_cols
                    return bk.merge(best, on=key_cols, how="left")
                table = merge_best(base_key, best)

                # For each day, fetch df rows matching the selected action; avg returns across symbols
                daily = []
                for _, row in table.iterrows():
                    d = row["et_date"]
                    if any(pd.isna(row[k]) for k in key_cols):  # missing bin
                        daily.append((d, np.nan)); continue
                    sel = base[(base["et_date"] == d) &
                               (base["method"] == row["method"]) &
                               (base["buy_pct"] == row["buy_pct"]) &
                               (base["sell_pct"] == row["sell_pct"])]
                    if sel.empty:
                        daily.append((d, np.nan))
                    else:
                        daily.append((d, float(sel["day_return"].mean())))
                by_day = pd.DataFrame(daily, columns=["et_date","day_return"]).dropna()
                eq = equity_from_returns(by_day["day_return"], start_capital)
                fig7, ax7 = plt.subplots()
                ax7.plot(by_day["et_date"], eq)
                ax7.set_title("Adaptive policy (in-sample rule table)")
                ax7.set_xlabel("Date"); ax7.set_ylabel("Equity"); ax7.grid(True, alpha=0.2)
                st.pyplot(fig7, use_container_width=True)
                st.dataframe(by_day, use_container_width=True)

        else:  # Walk-forward Adaptive
            if not reg_vars:
                st.warning("Select at least one regime field.")
            else:
                key_cols = [f"{rv}_bin" for rv in reg_vars]
                base = base.sort_values("et_date")
                dlist = sorted(base["et_date"].unique().tolist())

                out = []
                for i in range(int(train_win), len(dlist)):
                    train_days = dlist[i-int(train_win):i]
                    test_day = dlist[i]

                    train = base[base["et_date"].isin(train_days)]
                    # best action per regime in training
                    g = train.groupby(key_cols + ["method","buy_pct","sell_pct"], as_index=False).agg(
                        avg_ret=("day_return","mean"),
                        support=("day_return","size")
                    )
                    best = g.sort_values(["avg_ret","support"], ascending=[False,False]).groupby(key_cols, as_index=False).head(1)

                    # Get this day's regime key (we take first available row's bins for the day)
                    day_reg = base[base["et_date"] == test_day]
                    if day_reg.empty or any(k not in day_reg for k in key_cols):
                        out.append((test_day, np.nan)); continue
                    # Use mode bin for stability
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
                    if sel.empty:
                        out.append((test_day, np.nan))
                    else:
                        out.append((test_day, float(sel["day_return"].mean())))

                by_day = pd.DataFrame(out, columns=["et_date","day_return"]).dropna()
                eq = equity_from_returns(by_day["day_return"], start_capital)
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
