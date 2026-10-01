import { useMemo, useState } from "react";
import Papa from "papaparse";
import "./index.css";

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [error, setError] = useState("");

  const loadDemo = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/data/GOLD_STORE_HOUR.csv");

      if (!response.ok) {
        throw new Error("Could not load the demo dataset.");
      }

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const cleaned = result.data.map((row) => ({
            ...row,
            hour: parseNumber(row.hour),
            footfall: row.footfall === "" ? null : parseNumber(row.footfall),
            bills: parseNumber(row.bills),
            revenue: parseNumber(row.revenue),
            conversion_rate:
              row.conversion_rate === ""
                ? null
                : parseNumber(row.conversion_rate),
            sensor_ok: String(row.sensor_ok).toLowerCase() === "true",
          }));

          setRows(cleaned);
          setShowDashboard(true);
          setLoading(false);
        },
        error: () => {
          setError("Failed to parse the demo CSV.");
          setLoading(false);
        },
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!rows.length) return null;

    const usableRows = rows.filter((r) => r.sensor_ok);

    const totalVisitors = usableRows.reduce(
      (sum, r) => sum + parseNumber(r.footfall),
      0
    );

    const totalBills = rows.reduce(
      (sum, r) => sum + parseNumber(r.bills),
      0
    );

    const totalRevenue = rows.reduce(
      (sum, r) => sum + parseNumber(r.revenue),
      0
    );

    const measurableBills = usableRows.reduce(
      (sum, r) => sum + parseNumber(r.bills),
      0
    );

    const overallConversion =
      totalVisitors > 0 ? measurableBills / totalVisitors : 0;

    const hourlyMap = {};

    usableRows.forEach((r) => {
      if (!hourlyMap[r.hour]) {
        hourlyMap[r.hour] = {
          hour: r.hour,
          visitors: 0,
          bills: 0,
        };
      }

      hourlyMap[r.hour].visitors += parseNumber(r.footfall);
      hourlyMap[r.hour].bills += parseNumber(r.bills);
    });

    const hourly = Object.values(hourlyMap)
      .map((item) => ({
        ...item,
        conversion:
          item.visitors > 0 ? item.bills / item.visitors : 0,
      }))
      .sort((a, b) => a.hour - b.hour);

    const worstHours = [...hourly]
      .sort((a, b) => a.conversion - b.conversion)
      .slice(0, 3);

    const storeMap = {};

    usableRows.forEach((r) => {
      if (!storeMap[r.store_id]) {
        storeMap[r.store_id] = {
          store_id: r.store_id,
          city: r.city,
          format: r.format,
          visitors: 0,
          bills: 0,
          revenue: 0,
        };
      }

      storeMap[r.store_id].visitors += parseNumber(r.footfall);
      storeMap[r.store_id].bills += parseNumber(r.bills);
      storeMap[r.store_id].revenue += parseNumber(r.revenue);
    });

    const stores = Object.values(storeMap)
      .map((store) => ({
        ...store,
        conversion:
          store.visitors > 0
            ? store.bills / store.visitors
            : 0,
      }))
      .sort((a, b) => b.conversion - a.conversion);

    const dailyMap = {};

    usableRows.forEach((r) => {
      const key = `${r.store_id}_${r.trade_date}`;

      if (!dailyMap[key]) {
        dailyMap[key] = {
          store_id: r.store_id,
          trade_date: r.trade_date,
          footfall: 0,
          bills: 0,
        };
      }

      dailyMap[key].footfall += parseNumber(r.footfall);
      dailyMap[key].bills += parseNumber(r.bills);
    });

    const daysByStore = {};

    Object.values(dailyMap).forEach((day) => {
      if (!daysByStore[day.store_id]) {
        daysByStore[day.store_id] = [];
      }

      daysByStore[day.store_id].push(day);
    });

    const decileMap = {};

    Object.values(daysByStore).forEach((days) => {
      days.sort((a, b) => a.footfall - b.footfall);

      days.forEach((day, index) => {
        const decile = Math.min(
          10,
          Math.floor((index * 10) / days.length) + 1
        );

        if (!decileMap[decile]) {
          decileMap[decile] = {
            decile,
            visitors: 0,
            bills: 0,
          };
        }

        decileMap[decile].visitors += day.footfall;
        decileMap[decile].bills += day.bills;
      });
    });

    const deciles = Object.values(decileMap)
      .map((d) => ({
        ...d,
        conversion:
          d.visitors > 0 ? d.bills / d.visitors : 0,
      }))
      .sort((a, b) => a.decile - b.decile);

    return {
      totalVisitors,
      totalBills,
      totalRevenue,
      overallConversion,
      hourly,
      worstHours,
      stores,
      deciles,
      usableRows: usableRows.length,
      unknownRows: rows.length - usableRows.length,
    };
  }, [rows]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">DATABRICKS × SNOWFLAKE</div>
          <h1>Store Footfall & Sales Analytics</h1>
          <p>
            Retail intelligence from an end-to-end Bronze → Silver → Gold
            pipeline.
          </p>
        </div>
      </header>

      {!showDashboard ? (
        <main className="landing">
          <section className="hero-card">
            <div className="hero-copy">
              <span className="badge">CAPSTONE DEMO</span>
              <h2>Understand how store traffic turns into sales.</h2>
              <p>
                Explore the validated retail dataset generated through
                Databricks and analyzed through the project's Gold layer.
              </p>

              <button
                className="primary-btn"
                onClick={loadDemo}
                disabled={loading}
              >
                {loading ? "Loading Demo..." : "Try Demo"}
              </button>

              <button
                className="secondary-btn"
                onClick={() =>
                  alert("Upload mode will be added in the next stage.")
                }
              >
                Upload Your Data
              </button>

              {error && <p className="error">{error}</p>}
            </div>

            <div className="hero-visual">
              <div className="mini-chart">
                <span style={{ height: "35%" }} />
                <span style={{ height: "52%" }} />
                <span style={{ height: "42%" }} />
                <span style={{ height: "74%" }} />
                <span style={{ height: "61%" }} />
                <span style={{ height: "86%" }} />
                <span style={{ height: "69%" }} />
              </div>

              <div className="visual-label">
                Hourly conversion intelligence
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="dashboard">
          {stats && (
            <>
              <div className="dashboard-heading">
                <div>
                  <span className="badge">DEMO DATASET</span>
                  <h2>Store Performance Overview</h2>
                  <p>
                    {rows.length.toLocaleString("en-IN")} store-hour records
                    analyzed.
                  </p>
                </div>
              </div>

              <section className="kpi-grid">
                <div className="kpi-card">
                  <span>Total Visitors</span>
                  <strong>{formatNumber(stats.totalVisitors)}</strong>
                </div>

                <div className="kpi-card">
                  <span>Total Bills</span>
                  <strong>{formatNumber(stats.totalBills)}</strong>
                </div>

                <div className="kpi-card">
                  <span>Total Revenue</span>
                  <strong>{formatCurrency(stats.totalRevenue)}</strong>
                </div>

                <div className="kpi-card">
                  <span>Measured Conversion</span>
                  <strong>
                    {(stats.overallConversion * 100).toFixed(2)}%
                  </strong>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-label">Q1</span>
                    <h3>Conversion by Hour</h3>
                  </div>
                </div>

                <div className="bar-chart">
                  {stats.hourly.map((item) => {
                    const max =
                      Math.max(
                        ...stats.hourly.map(
                          (x) => x.conversion
                        )
                      ) || 1;

                    const height =
                      (item.conversion / max) * 100;

                    return (
                      <div className="bar-item" key={item.hour}>
                        <div className="bar-value">
                          {(item.conversion * 100).toFixed(1)}%
                        </div>

                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ height: `${height}%` }}
                          />
                        </div>

                        <span>{item.hour}:00</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="two-column">
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <span className="panel-label">Q2</span>
                      <h3>Three Worst Hours</h3>
                    </div>
                  </div>

                  <div className="worst-grid">
                    {stats.worstHours.map((item, index) => (
                      <div className="worst-card" key={item.hour}>
                        <span># {index + 1}</span>
                        <strong>{item.hour}:00</strong>
                        <small>
                          {(item.conversion * 100).toFixed(2)}%
                          conversion
                        </small>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <span className="panel-label">DATA QUALITY</span>
                      <h3>Sensor Coverage</h3>
                    </div>
                  </div>

                  <div className="quality-grid">
                    <div>
                      <strong>{stats.usableRows}</strong>
                      <span>usable store-hours</span>
                    </div>

                    <div>
                      <strong>{stats.unknownRows}</strong>
                      <span>unknown sensor-hours</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-label">STORE VIEW</span>
                    <h3>Store Conversion</h3>
                  </div>
                </div>

                <div className="store-table">
                  <div className="table-row table-head">
                    <span>Store</span>
                    <span>City</span>
                    <span>Format</span>
                    <span>Conversion</span>
                  </div>

                  {stats.stores.map((store) => (
                    <div className="table-row" key={store.store_id}>
                      <span>{store.store_id}</span>
                      <span>{store.city}</span>
                      <span>{store.format}</span>
                      <strong>
                        {(store.conversion * 100).toFixed(2)}%
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-label">Q3</span>
                    <h3>Footfall vs Conversion</h3>
                  </div>
                </div>

                <div className="decile-grid">
                  {stats.deciles.map((item) => (
                    <div
                      key={item.decile}
                      className="decile-card"
                    >
                      <span>D{item.decile}</span>
                      <strong>
                        {(item.conversion * 100).toFixed(2)}%
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="insight">
                  <strong>Insight:</strong>{" "}
                  The highest-footfall days convert at a lower rate than
                  the lowest-footfall days.
                </div>
              </section>

              <button
                className="secondary-btn back-btn"
                onClick={() => setShowDashboard(false)}
              >
                Back to Home
              </button>
            </>
          )}
        </main>
      )}
    </div>
  );
}

export default App;