import React, { useState, useEffect } from "react";
import {io} from 'socket.io-client';

const socket = io('http://localhost:5001');

interface VideoResultData {
  id?: string;
  original_filename?: string;
  video_url?: string;
  secure_url?: string;
  videoUrl?: string;
  caption?: string;
  ai_tags?: string[] | string;
  tags?: string[] | string;
  hashtags?: string[] | string;
  
}

export default function VideoDashboard(){
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Awaiting upload...');
  const [finalData, setFinalData] = useState<VideoResultData | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<'caption' | 'tags' | null>(null);

  useEffect(() => {
    socket.on('pipeline-update', (payload : { status: string; progress: number; message: string; data?: VideoResultData}) => {
      setProgress(payload.progress);
      setStatusMessage(payload.message);

      if(payload.status === 'completed' && payload.data){
        console.log("Incoming data:", payload.data);
        setFinalData(payload.data);
        setIsProcessing(false);
      }
    });

    return ()=>{
      socket.off('pipeline-update');
    }
  }, []);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>)=>{
    if(event.target.files && event.target.files.length > 0){
      const file = event.target.files[0];
      setSelectedFile(file);
      setStatusMessage(`Ready to process: ${file.name}`);
      setProgress(0);
      setFinalData(null);
    }
  };

  const handleUpload = async () => {
    if(!selectedFile) return;

    setIsProcessing(true);
    setStatusMessage('Uploading asset to server...');
    setProgress(10);

    const formData = new FormData();
    formData.append('asset', selectedFile);

    try {
      // 1. Initial upload to staging
      const uploadRes = await fetch('http://localhost:5001/api/v1/video/local-upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Local upload failed');
      const uploadData = await uploadRes.json();
      const videoId = uploadData.data?.id || uploadData.id;

      // 2. Trigger FFmpeg + Cloudinary + AI Pipeline
      const processRes = await fetch('http://localhost:5001/api/v1/video/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      if (!processRes.ok) throw new Error('Video processing request failed');
    } catch (error) {
      console.error('Pipeline failed:', error);
      setStatusMessage('Upload/Processing failed. Check server logs.');
      setIsProcessing(false);
    }  
  };

  const handleReset = () => {
    setSelectedFile(null);
    setProgress(0);
    setStatusMessage('Awaiting upload...');
    setFinalData(null);
    setIsProcessing(false);
  };

  const copyToClipboard = (text: string, type: 'caption' | 'tags') => {
    navigator.clipboard.writeText(text);
    setCopiedSection(type);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const parseTags = () : string[] => {
    if(!finalData) return [];
    const rawTags = finalData.tags || finalData.ai_tags || finalData.hashtags || [];

    if(Array.isArray(rawTags)){
      return rawTags.map((t) => (t.startsWith('#') ? t: `#${t.trim()}`));
    }
    if(typeof rawTags === 'string'){
      return rawTags.replace(/[{}"[\]]/g, '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#')?t : `#${t}`));
    }
    return [];
  };

  const tagsList = parseTags();
  const videoSource = finalData?.secure_url || finalData?.video_url || finalData?.videoUrl

  return (
  <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[650px]">

        {/* =========================================
            LEFT PANE: The Input / Upload Zone 
        ========================================= */}
        <div className="w-full md:w-1/2 p-8 md:p-12 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 flex flex-col justify-center items-center">
          
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-gray-800">Media Pipeline</h2>
            <p className="text-gray-500 mt-2">Upload a raw video to generate AI marketing assets.</p>
          </div>

          <div className="w-full max-w-md border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group">
            
            <svg className="w-16 h-16 text-gray-400 group-hover:text-blue-500 transition-colors mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            {/* Dynamic UI: Show file name if selected, otherwise show instructions */}
            {selectedFile ? (
              <div className="mb-6">
                <p className="text-blue-600 font-bold break-all">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            ) : (
              <>
                <p className="text-gray-700 font-semibold mb-1">Drag and drop your video here</p>
                <p className="text-sm text-gray-400 mb-6">MP4, WebM, or MOV up to 50MB</p>
              </>
            )}

            {/* The Input Button */}
            <label className={`px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer'
            }`}>
              {selectedFile ? 'Change File' : 'Browse Files'}
              <input 
                type="file" 
                className="hidden" 
                accept="video/*" 
                onChange={handleFileChange}
                disabled={isProcessing} 
              />
            </label>

            {/* Action Buttons */}
            {selectedFile && !finalData && (
              <button
                onClick={handleUpload}
                disabled={isProcessing}
                className={`mt-6 w-full px-6 py-3 rounded-lg font-bold shadow-md transition-all ${
                  isProcessing
                    ? 'bg-gray-400 text-gray-100 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isProcessing ? 'Processing in Pipeline...' : 'Upload & Process Video'}
              </button>
            )}

            {finalData && (
              <button
                onClick={handleReset}
                className="mt-6 w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-gray-300 transition-all"
              >
                Process Another Video
              </button>
            )}
          </div>

        </div>

        {/* =========================================
            RIGHT PANE: The Output / Results Zone 
        ========================================= */}
                {/* =========================================
            RIGHT PANE: The Output / Results Zone 
        ========================================= */}
        <div className="w-full md:w-1/2 p-8 md:p-12 bg-white flex flex-col items-center justify-center">
          
          {finalData ? (
            // ✅ WHAT TO SHOW WHEN PIPELINE IS COMPLETE
            <div className="w-full max-w-md flex flex-col gap-6 animate-fade-in">
              
              <div className="text-center">
                <h3 className="text-2xl font-extrabold text-green-600 mb-1">Pipeline Complete!</h3>
                <p className="text-gray-500 text-sm">Your assets are ready for production.</p>
              </div>

              {/* The Cloudinary Video Player */}
              {videoSource ? (
                <div className="w-full bg-black rounded-xl overflow-hidden shadow-lg border border-gray-200 flex justify-center">
                  <video 
                    src={videoSource}
                    controls 
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm text-center">
                  Video processed, but stream URL is missing in the response.
                </div>
              )}

              {/* The AI Marketing Metadata */}
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-blue-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    AI Generated Caption
                  </h4>
                  {finalData.caption && (
                    <button
                      onClick={() => copyToClipboard(finalData.caption || '', 'caption')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {copiedSection === 'caption' ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                <p className="text-gray-700 italic">"{finalData.caption || 'No caption generated'}"</p>
              </div>

              {/* Hashtags */}
              <div className="w-full mt-2">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-700 text-sm">Algorithmic Tags</h4>
                  {tagsList.length > 0 && (
                    <button
                      onClick={() => copyToClipboard(tagsList.join(' '), 'tags')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {copiedSection === 'tags' ? 'Copied!' : 'Copy All'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tagsList.length > 0 ? (
                    tagsList.map((tag: string, index: number) => (
                      <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors cursor-default">
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No tags extracted</span>
                  )}
                </div>
              </div>

            </div>
          ) : (
            // ⏳ WHAT TO SHOW WHILE WAITING / PROCESSING
            <div className="text-center opacity-70 w-full max-w-sm">
              <svg className="w-20 h-20 text-gray-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              
              <h3 className="text-xl font-bold text-gray-700 mb-4">{statusMessage}</h3>
              
              {/* This is the progress bar you asked about! */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden shadow-inner">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              
              <p className="text-gray-400 mt-2 text-sm font-medium">Processed video and AI metadata will appear here.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}