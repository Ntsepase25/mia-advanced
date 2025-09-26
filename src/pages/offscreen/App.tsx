/*
 * Sample code for offscreen document:
 *  https://github.com/GoogleChrome/chrome-extensions-samples/blob/main/functional-samples/sample.tabcapture-recorder
 */

import React, { useEffect } from 'react';

const App: React.FC = () => {
  useEffect(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.target === 'offscreen') {
        switch (message.type) {
          case 'start-recording':
            console.error('OFFSCREEN start-recording');
            startRecording(message.data, message.userId, message.micStreamId, message.tabUrl);
            break;
          case 'stop-recording':
            console.error('OFFSCREEN stop-recording');
            stopRecording();
            break;
          case 'test-microphone':
            console.log('OFFSCREEN test-microphone');
            testMicrophoneAccess().then((hasAccess) => {
              sendResponse({ hasAccess });
            });
            return true; // Keep the message channel open for async response
          default:
            throw new Error(`Unrecognized message: ${message.type}`);
        }
      }
    });
  }, []);

  let recorder: MediaRecorder | undefined;
  let data: Blob[] = [];
  let tabMedia: MediaStream | undefined;
  let micMedia: MediaStream | undefined;
  // Add variables to store meeting context
  let meetingId: string | undefined;
  let userId: string | undefined;
  let recordingStartTime: number | undefined;

  // Function to extract meeting ID from Google Meet URL
  function extractMeetingId(url: string): string | undefined {
    try {
      const urlObj = new URL(url);

      if (urlObj.hostname === 'meet.google.com') {
        const pathname = urlObj.pathname;

        // Handle different Google Meet URL formats
        if (pathname.startsWith('/lookup/')) {
          // Format: https://meet.google.com/lookup/meetingcode
          return pathname.split('/lookup/')[1];
        } else if (pathname.length > 1) {
          // Format: https://meet.google.com/abc-defg-hij
          return pathname.substring(1); // Remove leading slash
        }
      }

      return undefined;
    } catch (error) {
      console.error('Failed to parse URL:', error);
      return undefined;
    }
  }

  // Test if microphone access is available
  async function testMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.log('Microphone access test failed:', error);
      return false;
    }
  }

  async function startRecording(
    streamId: string,
    userId: string,
    micStreamId: string,
    tabUrl?: string
  ) {
    if (recorder?.state === 'recording') {
      throw new Error('Called startRecording while recording is in progress.');
    }

    // Store the organization ID
    userId = userId;

    // Extract meeting ID from the tab URL if provided
    if (tabUrl) {
      meetingId = extractMeetingId(tabUrl);
      console.log('Extracted meeting ID:', meetingId);
    }

    tabMedia = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    } as any);
    console.error('OFFSCREEN media', tabMedia);

    // Try to get microphone access for recording
    try {
      micMedia = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      console.log('OFFSCREEN microphone access granted', micMedia);
    } catch (error) {
      console.log('OFFSCREEN microphone access failed:', error);
      micMedia = undefined;
    }

    // Continue to play the captured audio to the user.
    const output = new AudioContext();
    const source = output.createMediaStreamSource(tabMedia);

    const destination = output.createMediaStreamDestination();

    source.connect(output.destination);
    source.connect(destination);

    // If we have microphone access, mix it in
    if (micMedia) {
      const micSource = output.createMediaStreamSource(micMedia);
      micSource.connect(destination);
      console.log('OFFSCREEN microphone mixed into recording');
    }

    console.error('OFFSCREEN output', output);

    // Start recording.
    recorder = new MediaRecorder(destination.stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (event: any) => data.push(event.data);
    recorder.onstop = async () => {
      const blob = new Blob(data, { type: 'video/webm' });

      // delete local state of recording
      chrome.runtime.sendMessage({
        action: 'set-recording',
        recording: false,
      });

      const formData = new FormData();
      formData.append('recording', blob);

      // Add meeting ID and user ID to the form data
      if (meetingId) {
        formData.append('meetingId', meetingId);
      }
      if (userId) {
        formData.append('userId', userId);
      }

      // Add timestamp and additional metadata
      formData.append('timestamp', new Date().toISOString());

      // Add metadata as JSON for more complex data
      formData.append(
        'metadata',
        JSON.stringify({
          meetingId: meetingId || null,
          userId: userId || null,
          timestamp: new Date().toISOString(),
          recordingDuration: recordingStartTime ? Date.now() - recordingStartTime : 0,
          hasMicrophone: micMedia ? true : false,
          meetingPlatform: meetingId ? 'google-meet' : 'unknown',
        })
      );

      fetch('http://localhost:8080/recordings/save', {
        method: 'post',
        body: formData,
      });

      // Clear state ready for next recording
      recorder = undefined;
      data = [];
    };
    recorder.start();
    recordingStartTime = Date.now();

    console.error('OFFSCREEN recorder started', recorder);

    chrome.runtime.sendMessage({
      action: 'set-recording',
      recording: true,
    });

    // Record the current state in the URL. This provides a very low-bandwidth
    // way of communicating with the service worker (the service worker can check
    // the URL of the document and see the current recording state). We can't
    // store that directly in the service worker as it may be terminated while
    // recording is in progress. We could write it to storage but that slightly
    // increases the risk of things getting out of sync.
    window.location.hash = 'recording';
  }

  async function stopRecording() {
    recorder?.stop();

    // Stop all tracks from both streams
    recorder?.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    tabMedia?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    micMedia?.getTracks().forEach((t: MediaStreamTrack) => t.stop());

    // Clear references
    tabMedia = undefined;
    micMedia = undefined;

    // Update current state in URL
    window.location.hash = '';

    // Note: In a real extension, you would want to write the recording to a more
    // permanent location (e.g IndexedDB) and then close the offscreen document,
    // to avoid keeping a document around unnecessarily. Here we avoid that to
    // make sure the browser keeps the Object URL we create (see above) and to
    // keep the sample fairly simple to follow.
  }

  return <div></div>;
};

export default App;
