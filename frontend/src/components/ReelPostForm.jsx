import { useEffect, useRef, useState } from 'react';
import { apiFetch, apiUpload, wakeUploadApi } from '../api/client';
import Icon from './Icon';
import {
  REEL_CAMERA_CONSTRAINTS,
  REEL_RECORDER_BITS,
  extForMime,
  formatBytes,
  pickRecorderMime,
  prepareReelVideo,
} from '../utils/reelVideo';

const SPORTS = [
  { value: 'mma', label: 'MMA' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'bjj', label: 'BJJ' },
  { value: 'kickboxing', label: 'Kickboxing' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'muay_thai', label: 'Muay Thai' },
  { value: 'general', label: 'General' },
];

const MAX_RECORD_SEC = 45;
const MAX_FILE_MB = 50;

export default function ReelPostForm({ onPosted, onError }) {
  const [mode, setMode] = useState('upload');
  const [postUrl, setPostUrl] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [postSport, setPostSport] = useState('mma');
  const [posting, setPosting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('');
  const [uploadPct, setUploadPct] = useState(0);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');

  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordPreview, setRecordPreview] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      stopCamera();
      if (filePreview) URL.revokeObjectURL(filePreview);
      if (recordPreview) URL.revokeObjectURL(recordPreview);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'camera') stopCamera();
  }, [mode]);

  function stopCamera() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setRecording(false);
  }

  async function startCamera() {
    onError('');
    setRecordedBlob(null);
    if (recordPreview) {
      URL.revokeObjectURL(recordPreview);
      setRecordPreview('');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(REEL_CAMERA_CONSTRAINTS);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      onError(e.message || 'Camera access denied. Allow camera/mic or upload an MP4 instead.');
    }
  }

  function startRecording() {
    if (!streamRef.current) return;
    const mime = pickRecorderMime();
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, {
      ...(mime ? { mimeType: mime } : {}),
      ...REEL_RECORDER_BITS,
    });
    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordPreview(url);
      setRecording(false);
      setRecordSeconds(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    rec.start(500);
    setRecording(true);
    setRecordSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SEC) {
          stopRecording();
          return MAX_RECORD_SEC;
        }
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }

  function onFileChange(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      onError(`Video must be under ${MAX_FILE_MB} MB.`);
      return;
    }
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(picked);
    setFilePreview(URL.createObjectURL(picked));
    onError('');
  }

  function clearFile() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function clearRecording() {
    if (recordPreview) URL.revokeObjectURL(recordPreview);
    setRecordedBlob(null);
    setRecordPreview('');
    setRecordSeconds(0);
  }

  const pendingBlob = mode === 'camera' ? recordedBlob : file;

  async function submitUrl(e) {
    e.preventDefault();
    setPosting(true);
    onError('');
    try {
      const data = await apiFetch('/api/reels', {
        method: 'POST',
        body: {
          videoUrl: postUrl.trim(),
          caption: postCaption.trim(),
          sport: postSport,
        },
      });
      onPosted(data.reel);
      setPostUrl('');
      setPostCaption('');
    } catch (err) {
      onError(err.message || 'Could not post reel');
    } finally {
      setPosting(false);
    }
  }

  async function submitUpload(e) {
    e.preventDefault();
    const raw = mode === 'camera' ? recordedBlob : file;
    if (!raw) {
      onError(mode === 'camera' ? 'Record a clip first.' : 'Choose an MP4 or WebM file.');
      return;
    }
    if (raw.size > MAX_FILE_MB * 1024 * 1024) {
      onError(`Video must be under ${MAX_FILE_MB} MB.`);
      return;
    }

    setPosting(true);
    setUploadPct(0);
    setUploadPhase('Connecting…');
    onError('');

    try {
      const [, blob] = await Promise.all([
        wakeUploadApi(),
        prepareReelVideo(raw, {
          onStatus: (msg) => setUploadPhase(msg),
        }),
      ]);

      setUploadPhase(`Uploading ${formatBytes(blob.size)}…`);

      const fd = new FormData();
      const mime = blob.type || 'video/mp4';
      const ext = extForMime(mime);
      const name = mode === 'camera' ? `reel-${Date.now()}${ext}` : raw.name || `reel${ext}`;
      fd.append('video', blob, name);
      fd.append('caption', postCaption.trim());
      fd.append('sport', postSport);

      const data = await apiUpload('/api/reels/upload', fd, {
        onProgress: (pct) => setUploadPct(Math.round(pct * 100)),
      });

      onPosted(data.reel);
      setPostCaption('');
      clearFile();
      clearRecording();
      stopCamera();
    } catch (err) {
      onError(err.message || 'Upload failed');
    } finally {
      setPosting(false);
      setUploadPhase('');
      setUploadPct(0);
    }
  }

  return (
    <div className="reels-post card">
      <div className="reels-post-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={mode === 'upload' ? 'is-active' : ''}
          aria-selected={mode === 'upload'}
          onClick={() => setMode('upload')}
        >
          <Icon name="upload" size={16} />
          Upload
        </button>
        <button
          type="button"
          role="tab"
          className={mode === 'camera' ? 'is-active' : ''}
          aria-selected={mode === 'camera'}
          onClick={() => setMode('camera')}
        >
          <Icon name="camera" size={16} />
          Record
        </button>
        <button
          type="button"
          role="tab"
          className={mode === 'url' ? 'is-active' : ''}
          aria-selected={mode === 'url'}
          onClick={() => setMode('url')}
        >
          <Icon name="link" size={16} />
          Link
        </button>
      </div>

      {mode === 'url' ? (
        <form onSubmit={submitUrl}>
          <label className="label">
            Video URL
            <input
              className="input"
              type="url"
              placeholder="YouTube or https://…/clip.mp4"
              value={postUrl}
              onChange={(ev) => setPostUrl(ev.target.value)}
              required
            />
          </label>
          <label className="label">
            Caption
            <input
              className="input"
              type="text"
              maxLength={500}
              placeholder="What's happening in camp?"
              value={postCaption}
              onChange={(ev) => setPostCaption(ev.target.value)}
            />
          </label>
          <label className="label">
            Sport
            <select className="select" value={postSport} onChange={(ev) => setPostSport(ev.target.value)}>
              {SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={posting}>
            {posting ? 'Posting…' : 'Share reel'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitUpload}>
          {mode === 'upload' ? (
            <div className="reels-capture-block">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="reels-file-input"
                onChange={onFileChange}
              />
              {filePreview ? (
                <video src={filePreview} className="reels-capture-preview" controls playsInline />
              ) : (
                <p className="muted reels-capture-hint">
                  MP4 or WebM, max {MAX_FILE_MB} MB. Large files are compressed before upload.
                </p>
              )}
              <div className="reels-capture-actions">
                <button type="button" className="btn btn-subtle btn-sm" onClick={() => fileInputRef.current?.click()}>
                  Choose file
                </button>
                {file ? (
                  <button type="button" className="btn btn-subtle btn-sm" onClick={clearFile}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="reels-capture-block">
              <video
                ref={videoRef}
                className="reels-capture-preview"
                playsInline
                muted={!recordPreview}
                src={recordPreview || undefined}
                controls={Boolean(recordPreview)}
              />
              {!cameraOn && !recordPreview ? (
                <button type="button" className="btn btn-subtle" onClick={startCamera}>
                  Enable camera
                </button>
              ) : null}
              {cameraOn && !recordPreview ? (
                <div className="reels-capture-actions">
                  {!recording ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={startRecording}>
                      Start recording
                    </button>
                  ) : (
                    <button type="button" className="btn btn-danger btn-sm" onClick={stopRecording}>
                      Stop ({recordSeconds}s / {MAX_RECORD_SEC}s)
                    </button>
                  )}
                  <button type="button" className="btn btn-subtle btn-sm" onClick={stopCamera}>
                    Cancel
                  </button>
                </div>
              ) : null}
              {recordPreview ? (
                <div className="reels-capture-actions">
                  <button
                    type="button"
                    className="btn btn-subtle btn-sm"
                    onClick={() => {
                      clearRecording();
                      startCamera();
                    }}
                  >
                    Re-record
                  </button>
                  <button type="button" className="btn btn-subtle btn-sm" onClick={clearRecording}>
                    Clear
                  </button>
                </div>
              ) : null}
              {recordedBlob ? (
                <p className="muted reels-capture-size">Clip size: {formatBytes(recordedBlob.size)}</p>
              ) : null}
            </div>
          )}

          {pendingBlob && mode === 'upload' ? (
            <p className="muted reels-capture-size">Selected: {formatBytes(pendingBlob.size)}</p>
          ) : null}

          {posting && uploadPhase ? (
            <div className="reels-upload-progress" aria-live="polite">
              <p className="reels-upload-label">{uploadPhase}</p>
              <div
                className="reels-upload-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadPct}
              >
                <div className="reels-upload-bar-fill" style={{ width: `${uploadPct}%` }} />
              </div>
              {uploadPct > 0 ? <span className="muted reels-upload-pct">{uploadPct}%</span> : null}
            </div>
          ) : null}

          <label className="label">
            Caption
            <input
              className="input"
              type="text"
              maxLength={500}
              placeholder="What's happening in camp?"
              value={postCaption}
              onChange={(ev) => setPostCaption(ev.target.value)}
            />
          </label>
          <label className="label">
            Sport
            <select className="select" value={postSport} onChange={(ev) => setPostSport(ev.target.value)}>
              {SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={posting}>
            {posting ? uploadPhase || 'Uploading…' : 'Share reel'}
          </button>
        </form>
      )}
    </div>
  );
}
