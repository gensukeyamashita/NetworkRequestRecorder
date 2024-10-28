document.addEventListener('DOMContentLoaded', () => {
  const recordTab = document.getElementById('recordTab');
  const replayTab = document.getElementById('replayTab');
  const recordSection = document.getElementById('recordSection');
  const replaySection = document.getElementById('replaySection');
  const toggleRecordBtn = document.getElementById('toggleRecordBtn');
  const replayBtn = document.getElementById('replayBtn');
  const fileInput = document.getElementById('fileInput');
  const replayFileInput = document.getElementById('replayFileInput');
  const filterInput = document.getElementById('filterInput');
  const applyFilterBtn = document.getElementById('applyFilterBtn');
  const tableBody = document.getElementById('tableBody');
  const statusDiv = document.getElementById('status');
  const statsDiv = document.getElementById('stats');
  const replayStatusDiv = document.getElementById('replayStatus');
  const closeButton = document.getElementById('close-button'); // Added close button

  // Initialize recording button state from storage
  chrome.storage.local.get(['isRecording'], (result) => {
    if (result.isRecording) {
      toggleRecordBtn.textContent = 'Stop Recording';
      updateStats();
    } else {
      toggleRecordBtn.textContent = 'Start Recording';
    }
  });

  // Switch to Record Tab
  recordTab.addEventListener('click', () => {
    recordTab.classList.add('active');
    replayTab.classList.remove('active');
    recordSection.classList.add('active');
    replaySection.classList.remove('active');
  });

  // Switch to Replay Tab
  replayTab.addEventListener('click', () => {
    replayTab.classList.add('active');
    recordTab.classList.remove('active');
    replaySection.classList.add('active');
    recordSection.classList.remove('active');
  });

  // Toggle Recording
  toggleRecordBtn.addEventListener('click', () => {
    const action = toggleRecordBtn.textContent === 'Start Recording' ? 'startRecording' : 'stopRecording';
    chrome.runtime.sendMessage({ action }, (response) => {
      toggleRecordBtn.textContent = response.status.includes('Started') ? 'Stop Recording' : 'Start Recording';
      statusDiv.textContent = response.status;
      chrome.storage.local.set({ isRecording: response.status.includes('Started') }); // Save state
      updateStats(); // Update stats if recording starts or stops
    });
  });

  // Handle Replay Button Click
  replayBtn.addEventListener('click', () => {
    replayStatusDiv.textContent = 'Replaying requests...';
    // Logic to replay requests goes here
    setTimeout(() => {
      replayStatusDiv.textContent = 'Replay complete.';
    }, 2000); // Example delay for replay completion
  });

  // Update Stats Periodically
  function updateStats() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      if (response.isRecording) {
        statsDiv.textContent = `Captured requests: ${response.requestCount}`;
      }
    });
  }
  setInterval(updateStats, 1000); // Update stats every second if recording

  // Load File in Record Tab
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const requests = JSON.parse(e.target.result);
          displayRequestsAndResponses(requests);
        } catch (_err) { // Prefixed with underscore
          tableBody.innerHTML = '<tr><td colspan="2">Error reading JSON file</td></tr>';
        }
      };
      reader.readAsText(file);
    }
  });

  // Load File in Replay Tab
  replayFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const requests = JSON.parse(e.target.result);
          replayStatusDiv.textContent = `Loaded ${requests.length} requests for replay.`;
        } catch (_err) { // Prefixed with underscore
          replayStatusDiv.textContent = 'Error reading JSON file for replay.';
        }
      };
      reader.readAsText(file);
    }
  });

  // Filter Functionality
  applyFilterBtn.addEventListener('click', () => {
    const filterValue = filterInput.value.toLowerCase();
    const filteredRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
      const requestDetails = row.querySelector('.requestDetails').innerText.toLowerCase();
      return requestDetails.includes(filterValue);
    });

    tableBody.innerHTML = '';  // Clear existing rows
    filteredRows.forEach(row => tableBody.appendChild(row));  // Re-add filtered rows
  });

  // Display Requests and Responses in the Table
  function displayRequestsAndResponses(requests) {
    tableBody.innerHTML = ''; // Clear previous entries

    requests.forEach((req) => {
      const requestDetails = `
        <strong>URL:</strong> ${req.url}<br>
        <strong>Method:</strong> ${req.method}<br>
        <strong>Mouse Position:</strong> (${req.mousePosition.x}, ${req.mousePosition.y})<br>
        <strong>Triggered Element:</strong> <pre>${req.triggeredElement || 'N/A'}</pre><br>
        <strong>Headers:</strong> <pre>${JSON.stringify(req.request.headers, null, 2)}</pre>
        <strong>Body:</strong> <pre>${JSON.stringify(req.request.body, null, 2)}</pre>
      `;

      const responseDetails = req.response ? `
        <strong>Status:</strong> ${req.response.status}<br>
        <strong>Status Text:</strong> ${req.response.statusText}<br>
        <strong>Headers:</strong> <pre>${JSON.stringify(req.response.headers, null, 2)}</pre>
        <strong>Error:</strong> ${req.response.error || 'None'}
      ` : 'No response data available';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="requestDetails">${requestDetails}</td>
        <td class="responseDetails">${responseDetails}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  // Close Button Functionality
  closeButton.addEventListener('click', () => {
    window.close(); // Close the popup window
  });
});
