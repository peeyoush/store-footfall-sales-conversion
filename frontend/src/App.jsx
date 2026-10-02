import { useMemo, useState } from "react";
import "./index.css";

import LandingPage from "./components/LandingPage";
import UploadPanel from "./components/UploadPanel";
import Dashboard from "./components/Dashboard";

import {
  loadDemoData,
  startUpload,
  uploadSingleFile,
  startUploadProcessing,
  waitForUploadCompletion,
  getUploadData,
} from "./services/api";

import { calculateStats } from "./utils/analytics";
function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [datasetLabel, setDatasetLabel] = useState("DEMO DATASET");
  const [mode, setMode] = useState("home");

  const [selectedFiles, setSelectedFiles] = useState({
    stores: null,
    footfall: null,
    bills: null,
  });

  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadInfo, setUploadInfo] = useState(null);

  const stats = useMemo(() => {
    return calculateStats(rows);
  }, [rows]);

  const handleDemo = async () => {
    setLoading(true);
    setError("");

    try {
      const demoRows = await loadDemoData();

      setRows(demoRows);
      setDatasetLabel("DEMO DATASET");
      setMode("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (
      !selectedFiles.stores ||
      !selectedFiles.footfall ||
      !selectedFiles.bills
    ) {
      setError("Please select all three CSV files.");
      return;
    }

    setLoading(true);
    setError("");
    setUploadStatus("Preparing upload...");
    setUploadInfo(null);

    try {
      const session = await startUpload();

      const runId = session.run_id;

      setUploadStatus("Uploading stores.csv...");
      await uploadSingleFile(
        runId,
        selectedFiles.stores
      );

      setUploadStatus("Uploading footfall.csv...");
      await uploadSingleFile(
        runId,
        selectedFiles.footfall
      );

      setUploadStatus("Uploading bills.csv...");
      await uploadSingleFile(
        runId,
        selectedFiles.bills
      );

      setUploadStatus(
        "Files uploaded. Starting Databricks processing..."
      );

      const processing = await startUploadProcessing(
        runId
      );

      setUploadInfo(processing);

      const completed =
        await waitForUploadCompletion(
          runId,
          processing.pipeline_run_id,
          (status) => {
            if (status.status === "processing") {
              setUploadStatus(
                "Processing data through Databricks..."
              );
            }
          }
        );

      setUploadStatus(
        "Loading your analytics..."
      );

      const uploadedRows =
        await getUploadData(runId);

      setRows(uploadedRows);
      setUploadInfo(completed);
      setDatasetLabel("UPLOADED DATA");
      setMode("dashboard");
    } catch (err) {
      setError(err.message);
      setUploadStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    setMode("home");
    setRows([]);
    setError("");
    setUploadStatus("");
    setUploadInfo(null);
    setDatasetLabel("DEMO DATASET");

    setSelectedFiles({
      stores: null,
      footfall: null,
      bills: null,
    });
  };
  const handleOpenUpload = () => {
    setMode("upload");
    setError("");
    setUploadStatus("");
  };

  return (
    <div className="app-shell">
      {mode === "home" && (
        <LandingPage
          loading={loading}
          error={error}
          onTryDemo={handleDemo}
          onUpload={handleOpenUpload}
        />
      )}

      {mode === "upload" && (
        <UploadPanel
          loading={loading}
          error={error}
          uploadStatus={uploadStatus}
          uploadInfo={uploadInfo}
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          onProcess={handleUpload}
          onBack={handleBackToHome}
        />
      )}

      {mode === "dashboard" && (
        <Dashboard
          rows={rows}
          stats={stats}
          datasetLabel={datasetLabel}
          uploadInfo={uploadInfo}
          onBack={handleBackToHome}
        />
      )}
    </div>
  );
}

export default App;