import React from 'react';

function App() {
  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    margin: 0,
    backgroundColor: '#0f172a',
    color: '#38bdf8',
    fontFamily: "'Inter', sans-serif",
  };

  const titleStyle = {
    fontSize: '3rem',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Assignment Hub</h1>
    </div>
  );
}

export default App;
