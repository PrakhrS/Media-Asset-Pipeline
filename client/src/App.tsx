
import { useEffect, useState } from 'react'
import './App.css'

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
    <div>
      <h1>Health Check :{data}</h1>
      <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempora voluptatem, iusto modi corrupti doloremque at nisi veritatis voluptatum porro odit. Optio ducimus repellendus quas labore officia est harum cumque explicabo!</p>

    </div>
  )

}

export default App

