import { useEffect, useState } from 'react'
import './App.css'
import VideoDashboard from './components/VideoDashboard'

function App() {
  const [data, setData] = useState("");
  useEffect(() => {
    const healthCheck = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.text();
        setData(data);
      } catch (error) {
        console.error('Failed to fetch health check:', error);
      }
    }
    healthCheck();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', margin: '0 auto' }}>
      <h1>Media Asset Pipeline</h1>
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '0.9rem' }}>
        <strong>Backend status:</strong> {data || 'Checking...'}
      </div>
      <VideoDashboard />
    </div>
  )
}

export default App

