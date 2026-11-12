import React from 'react';import{createRoot}from'react-dom/client';import UserGuides from '../../src/components/UserGuides.jsx';import '../../src/index.css';import '../../src/App.css';
createRoot(document.getElementById('root')).render(<main style={{padding:16}}><UserGuides driverId="capture-test" autoOpen showEntry/></main>);
