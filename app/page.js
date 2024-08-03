"use client"

// pages/index.js
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleButtonClick = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cloneAndProcess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl: 'https://github.com/WizdomCode/wizdomCode' }),
      });

      const data = await response.json();
      setResult(data.result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>GitHub Repo Processor</h1>
      <button onClick={handleButtonClick} disabled={loading}>
        {loading ? 'Processing...' : 'Process Repo'}
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
