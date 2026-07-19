import { useState, useEffect } from "react";
import {io} from 'socket.io-client';

const socket = io('http://localhost:5001');

export default function VideoDashboard(){
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Awaiting upload...');
  const [finalData, setFinalData] = useState<any>(null);

  useEffect(() => {
    socket.on('pipeline-update', (payload) => {
      setProgress(payload.progress);
      setStatusMessage(payload.message);

      if(payload.status === 'completed' && payload.data){
        console.log("Incoming data:", payload.data);
        setFinalData(payload.data);
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

    const formData = new FormData();
    formData.append('asset', selectedFile);

    try{
      setStatusMessage('Uploading raw file to server...');
      setProgress(10);

      const uploadRes = await fetch('http://localhost:5001/api/v1/video/local-upload', {
        method: 'POST',
        body: formData,
      });

      if(uploadRes.ok){
        const data = await uploadRes.json();

        await fetch('http://localhost:5001/api/v1/video/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({videoId: data.video.id})
        });
      } else{
        setStatusMessage('Upload Failed.');
      }
    }catch(error){
      console.error('Upload error:', error);
      setStatusMessage('Network error.');
    }
    
  };

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
            <label className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm hover:bg-blue-700 hover:shadow-md cursor-pointer transition-all">
              {selectedFile ? 'Change File' : 'Browse Files'}
              <input 
                type="file" 
                className="hidden" 
                accept="video/*" 
                onChange={handleFileChange} 
              />
            </label>

            {/* Upload Button */}
            {selectedFile && (
              <button
                onClick={handleUpload}
                className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all"
              >
                Upload & Process Video
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
              <div className="w-full bg-black rounded-xl overflow-hidden shadow-lg border border-gray-200">
                <video 
                  src={finalData.videoUrl || finalData.secure_url} // Adjust key based on your backend response
                  controls 
                  className="w-full h-auto"
                />
              </div>

              {/* The AI Marketing Metadata */}
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  AI Generated Caption
                </h4>
                <p className="text-gray-700 italic">"{finalData.caption || finalData.marketing_caption}"</p>
              </div>

              {/* Hashtags */}
              <div className="flex flex-wrap gap-2 mt-2">
                {(finalData.hashtags || ['#AI', '#Marketing', '#Tech']).map((tag: string, index: number) => (
                  <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors cursor-default">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
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