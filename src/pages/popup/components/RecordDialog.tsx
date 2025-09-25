import React, { useEffect, useState } from 'react';
import { authClient } from '../../../lib/auth-client';

export const RecordDialog: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('');
  const {data: session, isPending} = authClient.useSession()

  useEffect(() => {
    chrome.storage.session.get('recording', (result) => {
      setIsRecording(result.recording);
    });
    
    // Check microphone permission status
    checkMicrophonePermission();
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setPermissionStatus(permissionStatus.state);
    } catch (error) {
      console.log('Permission API not supported');
      setPermissionStatus('unknown');
    }
  };

  const handleRecordClick = async () => {
    if (isRecording) {
      console.log('Attempting to stop recording');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.id) {
          chrome.runtime.sendMessage({
            action: 'stopRecording',
            tabId: currentTab.id,
          });
          setIsRecording(false);
        }
      });
    } else {
      setIsChecking(true);
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.id) {
          chrome.runtime.sendMessage({
            action: 'startRecording',
            tabId: currentTab.id,
          });
          setIsRecording(true);
          setIsChecking(false);
        }
      });
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return ' Microphone access granted';
      case 'denied':
        return ' Microphone access denied';
      case 'prompt':
        return 'Microphone permission required';
      default:
        return ' Checking microphone access...';
    }
  };

  if (isPending) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', minWidth: '250px' }}>

      
      <div className="">
        {/* <h1 className="">MIA</h1> */}
        <p className="" style={{color: "#666"}}><span style={{fontWeight: "bold", fontSize: "24px", color: "black"}}>MIA</span><br /><br />Meeting Minutes Assistant.<br /><br /> Designed  to  automate taking minutes for meetings  </p>
 
      </div>
      
      
      
      <div style={{display: "flex", gap: "2px"}}>
        <button 
          onClick={handleRecordClick}
          disabled={isChecking}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isRecording ? '#f44336' : '#6750a4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isChecking ? 'not-allowed' : 'pointer'
          }}
        >
          {isChecking ? 'Checking permissions...' : 
           isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {!session && (
        <button style={{border: "none", borderRadius: "4px"}}><a style={{width: "100%",color :'black', textDecoration: "none", border: "none"}} href='http://localhost:5173/sign-in' target='_blank'>Login</a></button>
        )}
      </div>

      {/* <div style={{ marginBottom: '15px', fontSize: '12px', color: '#666' }}>
        {getPermissionStatusText()}
      </div> */}
      <p style={{color: "#666"}}>
        Recording is transcribed automatically when logged in
      </p>
      
      {permissionStatus === 'denied' && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#f44336' }}>
          Please enable microphone access in Chrome settings to record audio.
        </div>
      )}
    </div>
  );
};

export default RecordDialog;
