"""Builds data/tracker.json for the Live Tracker page.

Runs every weekday after the US market close (see .github/workflows/update-tracker.yml).
It re-computes, on fresh prices, the signals from three of my projects:

- signal-backtester:            SPY 50/200-day moving-average trend signal
- systematic-strategy-research: time-series momentum, dual momentum, sector rotation, risk parity
- portfolio-risk-report:        risk snapshot of the example tech-tilted portfolio

The rules are the same as in those repos: monthly strategies rebalance at month end and
hold the weights through the next month, with 5 bps cost per dollar traded.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

OUT = Path(__file__).resolve().parent.parent / "data" / "tracker.json"
SECTORS = ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]
RISK_PORT = {"AAPL": .20, "MSFT": .20, "NVDA": .10, "JPM": .10, "TLT": .25, "GLD": .15}
TICKERS = sorted(set(["SPY", "EFA", "AGG", "TLT", "GLD", "BIL", "SHY"] + SECTORS + list(RISK_PORT)))
COST_BPS = 5


def r(x, n=4):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), n)


def download(retries=3):
    """Download prices one request at a time (yfinance's threaded mode can lock its cache
    and silently drop tickers), retrying any ticker that comes back empty."""
    import tempfile, time
    yf.set_tz_cache_location(tempfile.mkdtemp())
    frames, missing = {}, list(TICKERS)
    for attempt in range(retries):
        if not missing:
            break
        df = yf.download(missing, start="2004-01-01", auto_adjust=True, progress=False, threads=False)["Close"]
        if isinstance(df, pd.Series):
            df = df.to_frame(missing[0])
        for t in missing:
            if t in df and df[t].notna().sum() > 0:
                frames[t] = df[t]
        missing = [t for t in TICKERS if t not in frames]
        if missing:
            print(f"Retrying {missing} (attempt {attempt + 2})")
            time.sleep(5 * (attempt + 1))
    if missing:
        # Fail loudly so the workflow keeps yesterday's data instead of publishing broken numbers
        raise SystemExit(f"Could not download: {missing}")
    return pd.DataFrame(frames).dropna(how="all")


# ---------- signal-backtester: SPY trend ----------
def spy_trend(px):
    spy = px["SPY"].dropna()
    sma50, sma200 = spy.rolling(50).mean(), spy.rolling(200).mean()
    above = sma50 > sma200
    flips = above.ne(above.shift()) & sma200.notna() & sma200.shift().notna()
    last_flip = flips[flips].index.max()
    window = spy.index[-380:]
    return {
        "signal": "LONG" if above.iloc[-1] else "CASH",
        "price": r(spy.iloc[-1], 2),
        "sma50": r(sma50.iloc[-1], 2),
        "sma200": r(sma200.iloc[-1], 2),
        "gap_pct": r(sma50.iloc[-1] / sma200.iloc[-1] - 1),
        "since": last_flip.strftime("%Y-%m-%d") if pd.notna(last_flip) else None,
        "series": {
            "dates": [d.strftime("%Y-%m-%d") for d in window],
            "price": [r(v, 2) for v in spy.loc[window]],
            "sma50": [r(v, 2) for v in sma50.loc[window]],
            "sma200": [r(v, 2) for v in sma200.loc[window]],
        },
    }


# ---------- systematic-strategy-research ----------
def monthly_strategies(px):
    daily = px.loc["2004-12-01":]
    m = daily.resample("ME").last()
    # treat the current, unfinished month as "month to date"
    m["CASH"] = m["BIL"].fillna(m["SHY"])
    rets = m.pct_change()

    def fixed(w):
        return pd.DataFrame(w, index=m.index)

    w = {"S&P 500": fixed({"SPY": 1.0}), "60/40": fixed({"SPY": .6, "AGG": .4})}

    mom = m["SPY"].shift(1) / m["SPY"].shift(12) - 1
    ts = pd.DataFrame(0.0, index=m.index, columns=["SPY", "CASH"])
    ts.loc[mom > 0, "SPY"] = 1.0
    ts.loc[~(mom > 0), "CASH"] = 1.0
    ts[mom.isna()] = np.nan
    w["Time-series momentum"] = ts

    look = m[["SPY", "EFA", "CASH"]].pct_change(12)
    winner = look[["SPY", "EFA"]].fillna(-np.inf).idxmax(axis=1)
    dual = pd.DataFrame(0.0, index=m.index, columns=["SPY", "EFA", "AGG"])
    for t in m.index:
        if look.loc[t].isna().any():
            dual.loc[t] = np.nan
        elif look.loc[t, winner[t]] > look.loc[t, "CASH"]:
            dual.loc[t, winner[t]] = 1.0
        else:
            dual.loc[t, "AGG"] = 1.0
    w["Dual momentum"] = dual

    sec_mom = m[SECTORS].pct_change(6)
    ranks = sec_mom.rank(axis=1, ascending=False)
    sec = (ranks <= 3).astype(float) / 3
    sec[sec_mom.isna().any(axis=1)] = np.nan
    w["Sector rotation"] = sec

    vol = daily[["SPY", "TLT", "GLD"]].pct_change().rolling(252).std().resample("ME").last()
    inv = 1 / vol
    w["Risk parity"] = inv.div(inv.sum(axis=1), axis=0)

    start = max(x.dropna(how="all").index[0] for x in w.values())
    out = {}
    for name, wt in w.items():
        wt = wt.loc[start:].reindex(columns=rets.columns).fillna(0.0)
        held = wt.shift(1)
        turnover = wt.diff().abs().sum(axis=1).shift(1).fillna(0)
        pr = ((held * rets.loc[start:]).sum(axis=1) - turnover * COST_BPS / 1e4).iloc[1:]
        out[name] = pr
    port = pd.DataFrame(out)
    eq = (1 + port).cumprod() * 10_000

    this_year = port.index[-1].year
    ytd = (1 + port[port.index.year == this_year]).prod() - 1
    years = len(port) / 12
    stats = {}
    for c in port:
        s = port[c]
        e = (1 + s).cumprod()
        stats[c] = {"cagr": r(e.iloc[-1] ** (1 / years) - 1), "vol": r(s.std() * np.sqrt(12)),
                    "sharpe": r(s.mean() / s.std() * np.sqrt(12), 2), "max_dd": r((e / e.cummax() - 1).min()),
                    "ytd": r(ytd[c])}

    # positions decided at the most recent COMPLETED month end, held this month
    last_close = m.index[-2] if daily.index[-1] < m.index[-1] else m.index[-1]
    sector_scores = sec_mom.loc[last_close].sort_values(ascending=False)
    positions = {
        "decided_at": last_close.strftime("%Y-%m-%d"),
        "ts_momentum": {"holding": "SPY" if mom.loc[last_close] > 0 else "T-bills",
                        "spy_12_1": r(mom.loc[last_close])},
        "dual_momentum": {"holding": next(k for k, v in dual.loc[last_close].items() if v == 1.0),
                          "spy_12m": r(look.loc[last_close, "SPY"]), "efa_12m": r(look.loc[last_close, "EFA"]),
                          "tbill_12m": r(look.loc[last_close, "CASH"])},
        "sector_rotation": [{"ticker": t, "ret_6m": r(v), "held": bool(i < 3)} for i, (t, v) in enumerate(sector_scores.items())],
        "risk_parity": {k: r(v) for k, v in w["Risk parity"].loc[last_close].items()},
    }
    return {
        "dates": [d.strftime("%Y-%m") for d in eq.index],
        "equity": {c: [r(v, 0) for v in eq[c]] for c in eq},
        "stats": stats,
        "positions": positions,
    }


# ---------- portfolio-risk-report ----------
def risk_snapshot(px):
    tick = list(RISK_PORT)
    w = pd.Series(RISK_PORT)
    daily = px[tick + ["SPY"]].dropna().pct_change().dropna().iloc[-252:]
    port = daily[tick] @ w
    spy = daily["SPY"]
    cov = daily[tick].cov() * 252
    contrib = w * (cov @ w) / float(w @ cov @ w)
    var95 = -np.percentile(port, 5)
    eq = (1 + port).cumprod()
    eq_spy = (1 + spy).cumprod()
    return {
        "holdings": {t: {"weight": r(w[t]), "risk_share": r(contrib[t])} for t in tick},
        "vol_1y": r(port.std() * np.sqrt(252)),
        "spy_vol_1y": r(spy.std() * np.sqrt(252)),
        "beta_1y": r(np.cov(port, spy)[0, 1] / spy.var(), 2),
        "var95": r(var95),
        "cvar95": r(-port[port <= -var95].mean()),
        "return_1y": r(eq.iloc[-1] - 1),
        "spy_return_1y": r(eq_spy.iloc[-1] - 1),
        "drawdown_now": r(eq.iloc[-1] / eq.cummax().iloc[-1] - 1),
        "series": {"dates": [d.strftime("%Y-%m-%d") for d in eq.index],
                   "portfolio": [r(v * 10_000, 0) for v in eq], "spy": [r(v * 10_000, 0) for v in eq_spy]},
    }


def main():
    px = download()
    data = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "as_of": px.index[-1].strftime("%Y-%m-%d"),
        "spy_trend": spy_trend(px),
        "strategies": monthly_strategies(px),
        "risk": risk_snapshot(px),
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    print(f"Wrote {OUT} (as of {data['as_of']}, {OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
