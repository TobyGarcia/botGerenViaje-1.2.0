import React from 'react';import{createRoot}from'react-dom/client';import TopBar from '../../src/components/TopBar.jsx';import '../../src/index.css';import '../../src/App.css';
createRoot(document.getElementById('root')).render(<div className="app-shell"><TopBar conductor={{id_conductores:'capture-test'}} onLogout={()=>{}}/><main style={{padding:16}}>Contenido de la app</main></div>);
