import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App.jsx';
import './index.css';
import { registerServiceWorker } from './utils/serviceWorkerRegistration.js';

// Register PWA Service Worker
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
