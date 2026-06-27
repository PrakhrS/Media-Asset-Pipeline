import React, { useState } from 'react';
import axios from 'axios';

interface VideoUploadResponse {
  message: string;
  video: {
    id: number;
    original_filename: string;
    local_filepath: string;
    created_at: string;
  };
}

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<VideoUploadResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setResponse(null);
      setProgress(0);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file first.');
      return;
    }

    const formData = new FormData();
    formData.append('asset', file);

    setUploading(true);
    setProgress(0);
    setError(null);
    setResponse(null);

    try {
      const res = await axios.post<VideoUploadResponse>(
        '/api/v1/video/local-upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setProgress(percentage);
            }
          },
        }
      );

      setResponse(res.data);
    } catch (err: any) {
      console.error('Upload error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to upload video.';
      setError(errMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Video Upload</h2>
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="video-file" style={{ display: 'block', marginBottom: '5px' }}>
            Select Video File:
          </label>
          <input
            id="video-file"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>

        {file && (
          <div style={{ marginBottom: '15px', fontSize: '0.9rem', color: '#555' }}>
            <strong>Selected file:</strong> {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
          </div>
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          style={{
            padding: '8px 16px',
            cursor: (!file || uploading) ? 'not-allowed' : 'pointer',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {uploading && (
        <div style={{ marginTop: '15px' }}>
          <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '4px', height: '10px' }}>
            <div
              style={{
                width: `${progress}%`,
                backgroundColor: '#0070f3',
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.1s ease-in-out',
              }}
            />
          </div>
          <div style={{ fontSize: '0.9rem', marginTop: '5px', textAlign: 'right' }}>
            {progress}%
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '15px', color: '#ff0000', padding: '10px', border: '1px solid #ff0000', borderRadius: '4px', backgroundColor: '#fff5f5' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && (
        <div style={{ marginTop: '15px', color: '#006600', padding: '10px', border: '1px solid #006600', borderRadius: '4px', backgroundColor: '#f5fff5' }}>
          <strong>Success:</strong> {response.message}
          <div style={{ marginTop: '5px', fontSize: '0.9rem', color: '#333' }}>
            <div><strong>ID:</strong> {response.video.id}</div>
            <div><strong>Filename:</strong> {response.video.original_filename}</div>
            <div><strong>Saved Path:</strong> {response.video.local_filepath}</div>
          </div>
        </div>
      )}
    </div>
  );
}
