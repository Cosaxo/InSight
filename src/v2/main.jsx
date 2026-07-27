/* eslint-disable */
// InSight v2 entry — the ported standalone_9 spec running under Vite.
// The spec modules communicate through the shared global scope (a faithful
// stand-in for the prototype's babel-standalone script tags); spec-index.js
// loads them in the original order, then App is picked up from globalThis.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './spec-index.js';

const App = globalThis.App;
createRoot(document.getElementById('root')).render(<App />);
