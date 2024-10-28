let requests = new Map();
let isRecording = false;
let lastClickedElement = null;
let lastMousePosition = { x: 0, y: 0 };

// Load the recording state from Chrome storage
chrome.storage.local.get(['isRecording'], (result) => {
  isRecording = result.isRecording || false;
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'elementClicked') {
    lastClickedElement = message.element;
    lastMousePosition = message.mousePosition;
  } else if (message.action === 'startRecording') {
    isRecording = true;
    chrome.storage.local.set({ isRecording: true }, () => {
      console.log('Recording started.');
      requests = new Map(); // Clear previous requests
      sendResponse({ status: 'Started recording' });
    });
  } else if (message.action === 'stopRecording') {
    isRecording = false;
    chrome.storage.local.set({ isRecording: false }, () => {
      console.log('Recording stopped.');

      // Create a timestamped filename
      const timestamp = formatTimestamp(new Date());
      const filename = sanitizeFilename('recording_' + timestamp + '.json');

      try {
        // Prepare request data for saving
        const requestsArray = Array.from(requests.values()).map(request => ({
          timestamp: request.timestamp,
          url: request.url,
          method: request.method,
          type: request.type,
          mousePosition: request.mousePosition,
          triggeredElement: request.triggeredElement,
          request: request.request,
          response: request.response
        }));

        // Create a Blob and URL for downloading the file
        const blob = new Blob([JSON.stringify(requestsArray, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Trigger file download
        chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download error:', chrome.runtime.lastError);
            sendResponse({ status: 'Error: ' + chrome.runtime.lastError.message });
          } else {
            console.log('File saved successfully.');
            sendResponse({ status: 'Stopped recording and saved file' });
          }
          URL.revokeObjectURL(url); // Revoke URL after download
        });
      } catch (error) {
        console.error('Error creating file:', error);
        sendResponse({ status: 'Error: ' + error.message });
      }
    });
  } else if (message.action === 'getStatus') {
    sendResponse({ 
      isRecording,
      requestCount: requests.size 
    });
  }
  return true; // Ensure asynchronous sendResponse
});

function sanitizeFilename(filename) {
  return filename.replace(/[:/?"*|<>]/g, '_').replace(/\s+/g, '_');
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
    try {
      const raw = details.requestBody.raw[0];
      if (raw.bytes) {
        const encoder = new TextDecoder('utf-8');
        return encoder.decode(raw.bytes);
      }
    } catch (_e) {
      return '[Binary Data]';
    }
  }
  if (details.requestBody.formData) {
    return details.requestBody.formData;
  }
  return null;
}

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (isRecording) {
      requests.set(details.requestId, {
        timestamp: new Date().toISOString(),
        url: details.url,
        method: details.method,
        type: details.type,
        mousePosition: { ...lastMousePosition },
        triggeredElement: lastClickedElement,
        request: {
          body: parseRequestBody(details),
          headers: {},
        },
        response: {}
      });
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (isRecording && requests.has(details.requestId)) {
      const request = requests.get(details.requestId);
      request.request.headers = details.requestHeaders.reduce((acc, header) => {
        acc[header.name] = header.value;
        return acc;
      }, {});
      requests.set(details.requestId, request);
    }
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

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
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.webRequest.onErrorOccurred.addListener(
  function(details) {
    if (isRecording && requests.has(details.requestId)) {
      const request = requests.get(details.requestId);
      request.response.error = details.error;
      requests.set(details.requestId, request);
    }
  },
  { urls: ['<all_urls>'] }
);
