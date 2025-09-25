// Check if microphone permission is available
const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    // Check if we can access microphone by testing in offscreen
    const existingContexts = await chrome.runtime.getContexts({});
    const offscreenDocument = existingContexts.find((c) => c.contextType === 'OFFSCREEN_DOCUMENT');

    if (offscreenDocument) {
      // Send a message to offscreen to test microphone access
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'test-microphone',
          target: 'offscreen',
        }, (response) => {
          resolve(response?.hasAccess || false);
        });
      });
    }

    return false;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
};

// Open permission request page
const openPermissionPage = async (): Promise<void> => {
  return new Promise((resolve) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('pages/permission/index.html'),
      active: true
    }, (tab) => {
      if (tab.id) {
        // Listen for tab updates to know when permission is granted
        const onUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId === tab.id && changeInfo.url) {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            chrome.tabs.onRemoved.removeListener(onRemoved);
            resolve();
          }
        };

        const onRemoved = (tabId: number) => {
          if (tabId === tab.id) {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            chrome.tabs.onRemoved.removeListener(onRemoved);
            resolve();
          }
        };

        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.tabs.onRemoved.addListener(onRemoved);
      } else {
        resolve();
      }
    });
  });
};

const startRecordingOffscreen = async (tabId: number) => {
  const existingContexts = await chrome.runtime.getContexts({});

  const offscreenDocument = existingContexts.find((c) => c.contextType === 'OFFSCREEN_DOCUMENT');

  // If an offscreen document is not already open, create one.
  if (!offscreenDocument) {
    console.error('OFFSCREEN no offscreen document');
    // Create an offscreen document.
    await chrome.offscreen.createDocument({
      url: 'pages/offscreen/index.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
      justification: 'Recording from chrome.tabCapture API',
    });
  }

  // Check microphone permission before starting recording
  const hasMicPermission = await checkMicrophonePermission();

  if (!hasMicPermission) {
    console.log('Microphone permission not granted, opening permission page...');
    await openPermissionPage();

    // Re-check permission after the page was opened
    const hasPermissionNow = await checkMicrophonePermission();
    if (!hasPermissionNow) {
      console.error('Microphone permission still not granted');
      return;
    }
  }

  // Get a MediaStream for the active tab.
  console.error('BACKGROUND getMediaStreamId');

  const streamId = await new Promise<string>((resolve) => {
    // chrome.tabCapture.getMediaStreamId({ consumerTabId: tabId }, (streamId) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      resolve(streamId);
    });
  });
  console.error('BACKGROUND streamId', streamId);

  const micStreamId = await new Promise<string>((resolve) => {
    chrome.tabCapture.getMediaStreamId({ consumerTabId: tabId }, (streamId) => {
      resolve(streamId);
    });
  });
  console.error('BACKGROUND micStreamId', micStreamId);

  // Send the stream ID to the offscreen document to start recording.
  chrome.runtime.sendMessage({
    type: 'start-recording',
    target: 'offscreen',
    data: streamId,
    micStreamId,
  });

  chrome.action.setIcon({ path: '/icons/recording.png' });
};

const stopRecordingOffscreen = async (tabId: number) => {
  console.error('OFFSCREEN stopping recording');
  
  // Send stop message to offscreen document
  chrome.runtime.sendMessage({
    type: 'stop-recording',
    target: 'offscreen',
  });
  
  // Update icon to not recording state
  chrome.action.setIcon({ path: 'icons/not-recording.png' });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording') {
    console.error('startRecording in background', JSON.stringify(message));
    startRecordingOffscreen(message.tabId);
    // startRecording(message.tabId, message.orgId);
    return true;
  } else if (message.action === 'stopRecording') {
    console.error('stopRecording in background');
    stopRecordingOffscreen(message.tabId);
    return true;
  } else if (message.action === 'set-recording') {
    console.error('set-recording in background', message.recording);
    chrome.storage.session.set({ recording: message.recording });
  }
});
