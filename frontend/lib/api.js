import { forgetSession, getSessionToken } from "./session";
import { API_URL } from "./site";

export async function api(path, options = {}, isRetry = false) {
  const token = await getSessionToken();
  let response;
  try {
    response = await fetch(API_URL + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token && { "X-Session": token }), ...options.headers },
    });
  } catch {
    const error = new Error("Can't reach the server. Check your connection and try again.");
    error.status = 0;
    throw error;
  }

  // the server doesn't know this session any more (e.g. it was deleted): start a new one, once
  if (response.status === 401 && token && !isRetry) {
    forgetSession();
    return api(path, options, true);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : null;
    const error = new Error(detail || `The server returned an error (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return body;
}

// using XHR here because fetch can't report upload progress
export async function uploadRecording(file, language, onProgress) {
  const token = await getSessionToken();
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("language", language);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL + "/recordings");
    if (token) xhr.setRequestHeader("X-Session", token);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response);
      if (xhr.status === 401) forgetSession();
      const detail = typeof xhr.response?.detail === "string" ? xhr.response.detail : null;
      reject(new Error(detail || `The upload failed (${xhr.status}). Please try again.`));
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.send(form);
  });
}
