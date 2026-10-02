import {
    formatNumber,
    formatCurrency,
} from "../utils/formatters";

function Dashboard({
    rows,
    stats,
    onBack,
    datasetLabel = "DEMO DATASET",
    uploadInfo,
}) {
    if (!stats) {
        return null;
    }

    const bestHour =
        stats.hourly.length > 0
            ? [...stats.hourly].sort(
                (a, b) => b.conversion - a.conversion
            )[0]
            : null;

    const worstHours = stats.worstHours;

    const highFootfallDecile =
        stats.deciles.find((item) => item.decile === 10);

    const lowFootfallDecile =
        stats.deciles.find((item) => item.decile === 1);

    const decileDifference =
        highFootfallDecile && lowFootfallDecile
            ? (highFootfallDecile.conversion -
                lowFootfallDecile.conversion) *
            100
            : null;

    const measuredCoverage =
        rows.length > 0
            ? (stats.usableRows / rows.length) * 100
            : 0;

    return (
        <main className="dashboard">
            {/* Header */}
            <div className="dashboard-heading">
                <div>
                    <span className="badge">{datasetLabel}</span>

                    {uploadInfo?.run_id && (
                        <p className="dataset-run">
                            Run ID: {uploadInfo.run_id}
                        </p>
                    )}

                    <h2>Retail Performance Overview</h2>

                    <p>
                        See where customer traffic converts into sales, when
                        performance drops, and how individual stores compare.
                    </p>
                </div>
            </div>

            {/* Executive Summary */}
            <section className="insight-hero">
                <div>
                    <span className="panel-label">
                        EXECUTIVE SUMMARY
                    </span>

                    <h3>
                        What is happening across your stores?
                    </h3>

                    <p>
                        Your stores recorded{" "}
                        <strong>
                            {formatNumber(stats.totalVisitors)}
                        </strong>{" "}
                        measured visitors and{" "}
                        <strong>
                            {formatNumber(stats.totalBills)}
                        </strong>{" "}
                        bills, generating{" "}
                        <strong>
                            {formatCurrency(stats.totalRevenue)}
                        </strong>{" "}
                        in revenue.
                    </p>

                    <p>
                        That means{" "}
                        <strong>
                            {(stats.overallConversion * 100).toFixed(2)}%
                        </strong>{" "}
                        of measured visitors converted into a bill.
                    </p>

                    {bestHour && (
                        <p>
                            Conversion is highest around{" "}
                            <strong>{bestHour.hour}:00</strong>, at{" "}
                            <strong>
                                {(bestHour.conversion * 100).toFixed(2)}%
                            </strong>
                            .
                        </p>
                    )}
                </div>
            </section>

            {/* KPIs */}
            <section className="kpi-grid">
                <div className="kpi-card">
                    <span>Measured Visitors</span>
                    <strong>
                        {formatNumber(stats.totalVisitors)}
                    </strong>
                    <small>
                        Visitors with usable footfall data
                    </small>
                </div>

                <div className="kpi-card">
                    <span>Bills Generated</span>
                    <strong>
                        {formatNumber(stats.totalBills)}
                    </strong>
                    <small>
                        Valid bills after data cleaning
                    </small>
                </div>

                <div className="kpi-card">
                    <span>Total Revenue</span>
                    <strong>
                        {formatCurrency(stats.totalRevenue)}
                    </strong>
                    <small>
                        Revenue represented in the Gold data
                    </small>
                </div>

                <div className="kpi-card">
                    <span>Visitor-to-Bill Conversion</span>
                    <strong>
                        {(stats.overallConversion * 100).toFixed(2)}%
                    </strong>
                    <small>
                        Bills ÷ measured visitors
                    </small>
                </div>
            </section>

            {/* Hourly performance */}
            <section className="panel">
                <div className="panel-header">
                    <div>
                        <span className="panel-label">
                            CUSTOMER BEHAVIOR
                        </span>

                        <h3>
                            When do customers convert best?
                        </h3>

                        <p>
                            Conversion rate by store-hour. Higher values mean
                            more measured visitors turned into bills.
                        </p>
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
                            <div
                                className="bar-item"
                                key={item.hour}
                            >
                                <div className="bar-value">
                                    {(item.conversion * 100).toFixed(1)}%
                                </div>

                                <div className="bar-track">
                                    <div
                                        className="bar-fill"
                                        style={{
                                            height: `${height}%`,
                                        }}
                                    />
                                </div>

                                <span>{item.hour}:00</span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Weakest hours + data quality */}
            <section className="two-column">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <span className="panel-label">
                                OPPORTUNITY WINDOWS
                            </span>

                            <h3>
                                When is conversion weakest?
                            </h3>

                            <p>
                                These are the three store-hours with the lowest
                                measured conversion.
                            </p>
                        </div>
                    </div>

                    <div className="worst-grid">
                        {worstHours.map((item, index) => (
                            <div
                                className="worst-card"
                                key={item.hour}
                            >
                                <span>
                                    {index + 1}
                                </span>

                                <strong>
                                    {item.hour}:00
                                </strong>

                                <small>
                                    {(item.conversion * 100).toFixed(2)}%
                                    {" "}
                                    conversion
                                </small>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <span className="panel-label">
                                DATA RELIABILITY
                            </span>

                            <h3>
                                How much of the footfall data is usable?
                            </h3>

                            <p>
                                We only use measured footfall when the sensor data
                                is available.
                            </p>
                        </div>
                    </div>

                    <div className="quality-grid">
                        <div>
                            <strong>
                                {stats.usableRows.toLocaleString("en-IN")}
                            </strong>

                            <span>
                                usable store-hours
                            </span>
                        </div>

                        <div>
                            <strong>
                                {stats.unknownRows.toLocaleString("en-IN")}
                            </strong>

                            <span>
                                hours without usable sensor data
                            </span>
                        </div>
                    </div>

                    <div className="quality-note">
                        {measuredCoverage.toFixed(1)}% of store-hour
                        records have usable sensor measurements.
                    </div>
                </div>
            </section>

            {/* Store comparison */}
            <section className="panel">
                <div className="panel-header">
                    <div>
                        <span className="panel-label">
                            STORE PERFORMANCE
                        </span>

                        <h3>
                            How does conversion differ by store?
                        </h3>

                        <p>
                            Compare customer conversion across individual
                            stores.
                        </p>
                    </div>
                </div>

                <div className="store-table">
                    <div className="table-row table-head">
                        <span>Store</span>
                        <span>City</span>
                        <span>Format</span>
                        <span>Visitors</span>
                        <span>Bills</span>
                        <span>Conversion</span>
                    </div>

                    {stats.stores.map((store) => (
                        <div
                            className="table-row"
                            key={store.store_id}
                        >
                            <span>{store.store_id}</span>

                            <span>{store.city}</span>

                            <span>{store.format}</span>

                            <span>
                                {formatNumber(store.visitors)}
                            </span>

                            <span>
                                {formatNumber(store.bills)}
                            </span>

                            <strong>
                                {(store.conversion * 100).toFixed(2)}%
                            </strong>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footfall vs conversion */}
            <section className="panel">
                <div className="panel-header">
                    <div>
                        <span className="panel-label">
                            TRAFFIC VS CONVERSION
                        </span>

                        <h3>
                            Does heavier footfall convert differently?
                        </h3>

                        <p>
                            Days are grouped into ten footfall bands separately
                            for each store, from the lowest-footfall days (D1)
                            to the highest-footfall days (D10).
                        </p>
                    </div>
                </div>

                <div className="decile-grid">
                    {stats.deciles.map((item) => (
                        <div
                            key={item.decile}
                            className="decile-card"
                        >
                            <span>
                                D{item.decile}
                            </span>

                            <strong>
                                {(item.conversion * 100).toFixed(2)}%
                            </strong>

                            <small>
                                {item.decile === 1
                                    ? "Lowest footfall"
                                    : item.decile === 10
                                        ? "Highest footfall"
                                        : "Footfall band"}
                            </small>
                        </div>
                    ))}
                </div>

                {lowFootfallDecile &&
                    highFootfallDecile && (
                        <div className="insight">
                            <strong>
                                Lower vs higher traffic:
                            </strong>{" "}
                            D1 conversion is{" "}
                            <strong>
                                {(lowFootfallDecile.conversion * 100).toFixed(2)}%
                            </strong>{" "}
                            while D10 conversion is{" "}
                            <strong>
                                {(highFootfallDecile.conversion * 100).toFixed(2)}%
                            </strong>
                            .

                            {decileDifference !== null && (
                                <>
                                    {" "}
                                    The difference is{" "}
                                    <strong>
                                        {Math.abs(decileDifference).toFixed(2)}
                                        {" "}
                                        percentage points
                                    </strong>
                                    .
                                </>
                            )}
                        </div>
                    )}
            </section>

            {/* Definitions */}
            <section className="definitions-card">
                <h3>How to read this dashboard</h3>

                <div className="definition-grid">
                    <div>
                        <strong>Conversion rate</strong>
                        <p>
                            The percentage of measured visitors who generated
                            a bill.
                        </p>
                    </div>

                    <div>
                        <strong>D1 → D10</strong>
                        <p>
                            Footfall bands calculated separately for each store,
                            from lower traffic days to higher traffic days.
                        </p>
                    </div>

                    <div>
                        <strong>Usable visitors</strong>
                        <p>
                            Only store-hours with valid sensor measurements are
                            included when calculating footfall-based conversion.
                        </p>
                    </div>
                </div>
            </section>

            <button
                className="secondary-btn back-btn"
                onClick={onBack}
            >
                Back to Home
            </button>
        </main>
    );
}

export default Dashboard;