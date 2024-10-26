let requests = new Map();
let isRecording = false;

function sanitizeFilename(filename) {
  return filename.replace(/[:/\\?*"|<>]/g, '_').replace(/\s+/g, '_');
}

function formatTimestamp(date) {
  return date.toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .replace(/[TZ]/g, '_')
    .trim();
}

function parseRequestBody(details) {
  if (!details.requestBody) return null;

  if (details.requestBody.raw) {
    // Handle raw request body data
    const encoder = new TextDecoder('utf-8');
    try {
      const raw = details.requestBody.raw[0];
      if (raw.bytes) {
        return encoder.decode(raw.bytes);
      }
    } catch (e) {
      return '[Binary Data]';
    }
  }

  if (details.requestBody.formData) {
    // Handle form data
    return details.requestBody.formData;
  }

  return null;
}

// Capture request headers and body
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (isRecording) {
      requests.set(details.requestId, {
        timestamp: new Date().toISOString(),
        url: details.url,
        method: details.method,
        type: details.type,
        requestBody: parseRequestBody(details),
        headers: {},  // Will be filled by onBeforeSendHeaders
        response: {}, // Will be filled by onCompleted
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Capture request headers
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (isRecording && requests.has(details.requestId)) {
      const request = requests.get(details.requestId);
      request.headers = details.requestHeaders.reduce((acc, header) => {
        acc[header.name] = header.value;
        return acc;
      }, {});
      requests.set(details.requestId, request);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// Capture response data
chrome.webRequest.onCompleted.addListener(
  function(details) {
    if (isRecording && requests.has(details.requestId)) {
      const request = requests.get(details.requestId);
      request.response = {
        status: details.statusCode,
        statusText: details.statusLine,
        headers: details.responseHeaders ? details.responseHeaders.reduce((acc, header) => {
          acc[header.name] = header.value;
          return acc;
        }, {}) : {}
      };
      requests.set(details.requestId, request);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Handle errors
chrome.webRequest.onErrorOccurred.addListener(
  function(details) {
    if (isRecording && requests.has(details.requestId)) {
      const request = requests.get(details.requestId);
      request.error = details.error;
      requests.set(details.requestId, request);
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording') {
    isRecording = true;
    requests = new Map();
    sendResponse({ status: 'Started recording' });
  } else if (message.action === 'stopRecording') {
    isRecording = false;
    const timestamp = formatTimestamp(new Date());
    const filename = sanitizeFilename(`network_requests_${timestamp}.json`);
    
    try {
      // Convert Map to Array and format the output
      const requestsArray = Array.from(requests.values()).map(request => ({
        timestamp: request.timestamp,
        url: request.url,
        method: request.method,
        type: request.type,
        request: {
          headers: request.headers,
          body: request.requestBody
        },
        response: {
          status: request.response.status,
          statusText: request.response.statusText,
          headers: request.response.headers
        },
        error: request.error
      }));

      const blob = new Blob([JSON.stringify(requestsArray, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          sendResponse({ status: 'Error: ' + chrome.runtime.lastError.message });
        } else {
          sendResponse({ status: 'Stopped recording and saved file' });
        }
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Error creating file:', error);
      sendResponse({ status: 'Error: ' + error.message });
    }
  } else if (message.action === 'getStatus') {
    sendResponse({ 
      isRecording,
      requestCount: requests.size 
    });
  }
  return true;
});