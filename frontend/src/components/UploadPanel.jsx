function UploadPanel({
  loading,
  error,
  uploadStatus,
  selectedFiles,
  setSelectedFiles,
  onProcess,
  onBack,
}) {
  const handleFileChange = (key, event) => {
    const file = event.target.files?.[0] || null;

    setSelectedFiles((current) => ({
      ...current,
      [key]: file,
    }));
  };

  const files = [
    {
      key: "stores",
      filename: "stores.csv",
      description: "Store information and format",
    },
    {
      key: "footfall",
      filename: "footfall.csv",
      description: "Hourly visitor and sensor data",
    },
    {
      key: "bills",
      filename: "bills.csv",
      description: "Bill and sales transactions",
    },
  ];

  const allFilesSelected =
    selectedFiles.stores &&
    selectedFiles.footfall &&
    selectedFiles.bills;

  return (
    <main className="landing">
      <section className="hero-card">
        <div className="hero-copy upload-page-copy">
          <span className="badge">UPLOAD MODE</span>

          <h2>Analyze your own store data.</h2>

          <p className="upload-intro">
            Upload the three required CSV files. We'll validate,
            clean, process, and analyze your data automatically.
          </p>

          <div className="upload-panel">
            <div className="upload-panel-header">
              <div>
                <h3>Upload your data</h3>
                <p>
                  Select all three files to start the analysis.
                </p>
              </div>
            </div>

            <div className="file-list">
              {files.map((file) => {
                const selected = selectedFiles[file.key];

                return (
                  <div
                    className={`file-card ${
                      selected ? "file-card-selected" : ""
                    }`}
                    key={file.key}
                  >
                    <div className="file-icon">
                      CSV
                    </div>

                    <div className="file-details">
                      <strong>{file.filename}</strong>

                      <span>
                        {selected
                          ? selected.name
                          : file.description}
                      </span>
                    </div>

                    <label
                      className={`file-browse ${
                        loading ? "disabled" : ""
                      }`}
                    >
                      {selected ? "Change" : "Choose file"}

                      <input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={loading}
                        onChange={(event) =>
                          handleFileChange(
                            file.key,
                            event
                          )
                        }
                      />
                    </label>

                    {selected && (
                      <span className="file-check">
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="upload-note">
              <span>ⓘ</span>
              <span>
                CSV files only. Make sure the files use the
                expected column structure.
              </span>
            </div>

            <div className="upload-actions">
              <button
                className="primary-btn"
                onClick={onProcess}
                disabled={
                  loading || !allFilesSelected
                }
              >
                {loading
                  ? "Processing..."
                  : "Process Data"}
              </button>

              <button
                className="secondary-btn"
                onClick={onBack}
                disabled={loading}
              >
                Back
              </button>
            </div>

            {uploadStatus && (
              <div className="upload-status-box">
                <span className="status-dot" />
                <span>{uploadStatus}</span>
              </div>
            )}

            {error && (
              <div className="upload-error">
                {error}
              </div>
            )}
          </div>
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
            End-to-end data processing
          </div>
        </div>
      </section>
    </main>
  );
}

export default UploadPanel;