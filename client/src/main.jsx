import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: '#1E1E1E',
          color: '#fff',
          border: '1px solid #2A2A2A',
        },
        success: { iconTheme: { primary: '#39FF14', secondary: '#121212' } },
        error:   { iconTheme: { primary: '#FF4444', secondary: '#121212' } },
      }}
    />
  </React.StrictMode>
);
