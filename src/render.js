// Dependencies
const { desktopCapturer, remote } = require('electron');
const { Menu, dialog } = remote;
const { writeFile } = require('fs');
const ysFixWebmDuration = require('fix-webm-duration');

let mediaRecorder; // MediaRecorder instance to capture footage
let recordedChunks = [];
let lastSelectedSource;
let startTime;
let isRecording = false;

let audioRecording = true;
let videoPlayback = true;
let initialLoad = true;

let autoSave = false;


// Buttons
const buttonContainer = document.getElementById('buttonContainer');

const videoElement = document.querySelector('video');
const videoContainer = document.getElementById('videoContainer');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const videoSelectBtn = document.getElementById('videoSelectBtn');
const recordAudioBtn = document.getElementById('recordAudioBtn');
const showVideoBtn = document.getElementById('showVideoBtn');
const autoSaveBtn = document.getElementById('autoSaveBtn');
const autoSaveNum = document.getElementById('autoSaveNum');
const autoSaveCont = document.getElementById('autoSaveCont');

startBtn.addEventListener('click', e => {
  if (!isRecording)
  {
    mediaRecorder.start();
    isRecording = true;
    startTime = Date.now();
    
    startBtn.classList.add('is-danger');
    startBtn.innerText = 'Nagrywanie';
  
    videoSelectBtn.disabled = true;
    recordAudioBtn.disabled = true;
    showVideoBtn.disabled = true;
    autoSaveBtn.disabled = true;
    autoSaveNum.disabled = true;
  
    stopBtn.style.display = "inline-block";
  }
});

stopBtn.addEventListener('click', e => {
  mediaRecorder.stop();

  startBtn.classList.remove('is-danger');
  startBtn.innerText = 'Start';

  videoSelectBtn.disabled = false;
  recordAudioBtn.disabled = false;
  showVideoBtn.disabled = false;
  autoSaveBtn.disabled = false;
  autoSaveNum.disabled = false;

  stopBtn.style.display = "none";

  isRecording = false;
});

videoSelectBtn.addEventListener('click', getVideoSources);

recordAudioBtn.addEventListener('click', e => {
    if (audioRecording) {
        recordAudioBtn.innerText = 'Nagrywanie wyłączone';
        audioRecording = false;
    }
    else {
        recordAudioBtn.innerText = 'Nagrywanie włączone';
        audioRecording = true;
    }

    selectSource(lastSelectedSource);
});

showVideoBtn.addEventListener('click', e => {
    if (videoPlayback) {
        videoContainer.style.display = "none";
        showVideoBtn.innerText = 'Podgląd wyłączony';
        videoPlayback = false;
    }
    else {
        videoContainer.style.display = "block";
        showVideoBtn.innerText = 'Podgląd włączony';
        videoPlayback = true;
    }

    selectSource(lastSelectedSource);
});

autoSaveBtn.addEventListener('click', e => {
    if (!autoSave) {
      autoSaveBtn.innerText = 'Zapisuj automatycznie co';
      autoSaveCont.style.display = "inline-block";
      autoSave = true;
    }
    else {
      autoSaveBtn.innerText = 'Nie zapisuj automatycznie';
      autoSaveCont.style.display = "none";
      autoSave = false;
    }
});


// Get the available video sources
async function getVideoSources() {
    const inputSources = await desktopCapturer.getSources({
        types: ['window', 'screen']
    });

    const videoOptionsMenu = Menu.buildFromTemplate(
        inputSources.map(source => {
            return {
                label: source.name,
                click: () => selectSource(source)
            };
        })
    );

    videoOptionsMenu.popup();
}


// Change the videoSource window to record
async function selectSource(source) {
    lastSelectedSource = source;

    videoSelectBtn.innerText = source.name;

    // Get default audio output
    // const audioDevices = await navigator.mediaDevices.enumerateDevices();
    // const defaultAudio = audioDevices.find(d => d.deviceId == "default" && d.kind == "audioinput");
    // console.log(defaultAudio);

    const enable = {
        mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
        }
    };

    const constraints = (audioRecording) ? { 
        audio: enable,
        video: enable
    } : {
        video: enable
    };

    console.log('Constraints: ', constraints);

    // Create a Stream
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Preview the source in a video element
    if (videoPlayback) {
        videoElement.srcObject = stream;
        videoElement.play();
    } else {
        videoElement.srcObject = null;
        videoElement.pause();
    }

    // Create the Media Recorder
    const options = { mimeType: 'video/webm; codecs=vp9' };
    mediaRecorder = new MediaRecorder(stream, options);

    // Register Event Handlers
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;

    // Change UI if the first source was picked
    if (initialLoad) {
        showVideoBtn.disabled = false;
        recordAudioBtn.disabled = false;
        videoContainer.style.display = "block";
        buttonContainer.style.display = "block";
        autoSaveBtn.disabled = false;
        autoSaveNum.disabled = false;
        initialLoad = false;
    }
}


// Captures all recorded chunks
function handleDataAvailable(e) {
    console.log('Video data available');
    recordedChunks.push(e.data);
}


// Saves the video file on stop
async function handleStop(e) {
    const duration = Date.now() - startTime;
    console.log('Duration:', `${duration} ms`);

    let blobOrigin = new Blob(recordedChunks, {
        type: 'video/webm; codecs=vp9'
    });
    console.log('Original blob', blobOrigin);

    ysFixWebmDuration(blobOrigin, duration, async function(fixedBlob) {
        console.log('Fixed blob', fixedBlob);

        const buffer = Buffer.from(await fixedBlob.arrayBuffer());

        const { filePath } = await dialog.showSaveDialog({
            buttonLabel: 'Save video',
            defaultPath: `vid-${Date.now()}.webm`
        });
    
        console.log('File path:', filePath);
    
        writeFile(filePath, buffer, () => console.log('Video saved successfully!'));
    
        recordedChunks = [];
    });
}