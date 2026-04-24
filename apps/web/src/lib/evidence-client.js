"use client";

import { apiRequest } from "./api";

const EVIDENCE_SESSION_STORAGE_KEY = "novoriq-evidence-session-id";
const FINGERPRINT_SCRIPT_ID = "novoriq-fingerprintjs-script";

function getStoredSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(EVIDENCE_SESSION_STORAGE_KEY) || "";
}

function setStoredSessionId(sessionId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EVIDENCE_SESSION_STORAGE_KEY, sessionId);
}

function loadFingerprintScript(publicKey) {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(FINGERPRINT_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      if (window.FingerprintJS) {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = FINGERPRINT_SCRIPT_ID;
    script.async = true;
    script.src = `https://fpjscdn.net/v3/${publicKey}`;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

async function resolveFingerprintId(publicKey) {
  if (!publicKey) {
    return "";
  }

  await loadFingerprintScript(publicKey);

  if (!window.FingerprintJS) {
    return "";
  }

  const fp = await window.FingerprintJS.load();
  const result = await fp.get();
  return typeof result?.visitorId === "string" ? result.visitorId : "";
}

export async function ensureEvidenceSession(fingerprintPublicKey) {
  const existingSessionId = getStoredSessionId();
  if (existingSessionId) {
    return existingSessionId;
  }

  const fingerprintId = await resolveFingerprintId(fingerprintPublicKey);
  if (!fingerprintId) {
    return "";
  }

  const response = await apiRequest("/api/evidence/session", {
    method: "POST",
    body: JSON.stringify({
      fingerprintId,
      userAgent: navigator.userAgent
    })
  });

  if (typeof response?.sessionId === "string" && response.sessionId) {
    setStoredSessionId(response.sessionId);
    return response.sessionId;
  }

  return "";
}

export async function logEvidenceActivity(action, metadata = {}, fingerprintPublicKey = "") {
  const sessionId = await ensureEvidenceSession(fingerprintPublicKey);
  if (!sessionId) {
    return;
  }

  await apiRequest("/api/evidence/activity", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      action,
      metadata
    })
  });
}
