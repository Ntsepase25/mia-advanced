document.addEventListener('DOMContentLoaded', () => {
  const requestButton = document.getElementById('requestPermission') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;

  // Check if we already have permission
  checkPermissionStatus();

  requestButton.addEventListener('click', requestMicrophonePermission);

  async function checkPermissionStatus() {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (permissionStatus.state === 'granted') {
        showSuccess('Microphone permission already granted!');
        setTimeout(() => {
          window.close();
        }, 2000);
      } else if (permissionStatus.state === 'denied') {
        showError('Microphone permission was denied. Please go to Chrome settings to enable it.');
        requestButton.textContent = 'Open Chrome Settings';
        requestButton.onclick = openChromeSettings;
      }
    } catch (error) {
      console.log('Permission API not supported, will try getUserMedia');
    }
  }

  async function requestMicrophonePermission() {
    try {
      statusDiv.textContent = 'Requesting microphone permission...';
      requestButton.disabled = true;

      // Request microphone access - this will show the permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately as we only needed to get permission
      stream.getTracks().forEach(track => track.stop());
      
      showSuccess('Microphone permission granted successfully!');
      
      // Close the window after a short delay
      setTimeout(() => {
        window.close();
      }, 2000);
      
    } catch (error: any) {
      console.error('Permission request failed:', error);
      
      if (error.name === 'NotAllowedError') {
        showError('Microphone permission was denied. Please try again or check your browser settings.');
        requestButton.textContent = 'Open Chrome Settings';
        requestButton.onclick = openChromeSettings;
      } else {
        showError('Failed to request microphone permission: ' + error.message);
      }
      requestButton.disabled = false;
    }
  }

  function openChromeSettings() {
    chrome.tabs.create({
      url: `chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2F${chrome.runtime.id}`
    });
  }

  function showSuccess(message: string) {
    statusDiv.className = 'success';
    statusDiv.textContent = message;
  }

  function showError(message: string) {
    statusDiv.className = 'error';
    statusDiv.textContent = message;
  }
}); 