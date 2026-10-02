import Papa from "papaparse";

import { parseNumber } from "../utils/formatters";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";


function parseCsvRows(csvText) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,

      complete: (result) => {
        const cleaned = result.data.map((row) => ({
          ...row,
          hour: parseNumber(row.hour),

          footfall:
            row.footfall === ""
              ? null
              : parseNumber(row.footfall),

          bills: parseNumber(row.bills),
          revenue: parseNumber(row.revenue),

          conversion_rate:
            row.conversion_rate === ""
              ? null
              : parseNumber(row.conversion_rate),

          sensor_ok:
            String(row.sensor_ok).toLowerCase() === "true",
        }));

        resolve(cleaned);
      },

      error: (error) => {
        reject(error);
      },
    });
  });
}


export async function loadDemoData() {
  const response = await fetch(
    "/data/GOLD_STORE_HOUR.csv"
  );

  if (!response.ok) {
    throw new Error(
      "Could not load the demo dataset."
    );
  }

  const csvText = await response.text();

  return parseCsvRows(csvText);
}


export async function startUpload() {
  const response = await fetch(
    `${API_BASE_URL}/api/upload/start`,
    {
      method: "POST",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Could not start upload."
    );
  }

  return data;
}


export async function uploadSingleFile(runId, file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/upload/${runId}/file`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
        `Could not upload ${file.name}.`
    );
  }

  return data;
}


export async function startUploadProcessing(runId) {
  const response = await fetch(
    `${API_BASE_URL}/api/upload/${runId}/process`,
    {
      method: "POST",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
        "Could not start data processing."
    );
  }

  return data;
}

export async function getUploadStatus(
  runId,
  pipelineRunId
) {
  const response = await fetch(
    `${API_BASE_URL}/api/upload/status/${runId}/${pipelineRunId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
        "Could not retrieve upload status."
    );
  }

  return data;
}


export async function getUploadSummary(runId) {
  const response = await fetch(
    `${API_BASE_URL}/api/upload/summary/${runId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
        "Could not retrieve uploaded data."
    );
  }

  return data;
}


export async function waitForUploadCompletion(
  runId,
  pipelineRunId,
  onUpdate
) {
  const maxAttempts = 60;
  const intervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await getUploadStatus(
      runId,
      pipelineRunId
    );

    if (onUpdate) {
      onUpdate(data);
    }

    if (data.status === "completed") {
      return data;
    }

    if (data.status === "failed") {
      throw new Error(
        data.databricks?.state_message ||
          "Databricks processing failed."
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, intervalMs)
    );
  }

  throw new Error(
    "Processing is taking longer than expected."
  );
}

export async function getUploadData(runId) {
  const response = await fetch(
    `${API_BASE_URL}/api/upload/data/${runId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Could not retrieve uploaded data."
    );
  }

  return data.rows;
}