document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDiv = document.getElementById('status');
  const statsDiv = document.getElementById('stats');
  
  function updateStats() {
    if (!toggleBtn.classList.contains('recording')) return;
    
    chrome.runtime.sendMessage({ action: 'getStatus' }, response => {
      if (response.isRecording) {
        statsDiv.textContent = `Captured requests: ${response.requestCount}`;
      }
    });
  }

  // Check initial recording status
  chrome.runtime.sendMessage({ action: 'getStatus' }, response => {
    updateButtonState(response.isRecording);
    if (response.isRecording) {
      statsDiv.textContent = `Captured requests: ${response.requestCount}`;
    }
  });

  toggleBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getStatus' }, response => {
      const isRecording = response.isRecording;
      const action = isRecording ? 'stopRecording' : 'startRecording';
      
      chrome.runtime.sendMessage({ action }, response => {
        updateButtonState(!isRecording);
        if (response.status.startsWith('Error:')) {
          statusDiv.textContent = response.status;
          statusDiv.style.color = '#ff4444';
        } else {
          statusDiv.textContent = response.status;
          statusDiv.style.color = '#666';
        }
      });
    });
  });

  // Update stats periodically when recording
  setInterval(updateStats, 1000);
});

function updateButtonState(isRecording) {
  const toggleBtn = document.getElementById('toggleBtn');
  toggleBtn.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
  toggleBtn.className = isRecording ? 'recording' : '';
}