function LandingPage({
  loading,
  error,
  onTryDemo,
  onUpload,
}) {
  return (
    <main className="landing">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="badge">CAPSTONE DEMO</span>

          <h2>
            Understand how store traffic turns into sales.
          </h2>

          <p>
            Explore the validated retail dataset generated through
            Databricks and analyzed through the project's Gold layer.
          </p>

          <button
            className="primary-btn"
            onClick={onTryDemo}
            disabled={loading}
          >
            {loading ? "Loading Demo..." : "Try Demo"}
          </button>

          <button
            className="secondary-btn"
            onClick={onUpload}
          >
            Upload Your Data
          </button>

          {error && (
            <p className="error">
              {error}
            </p>
          )}
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
  );
}

export default LandingPage;