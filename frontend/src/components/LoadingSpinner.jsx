import React from 'react';
import '../styles/LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', color = '#3498db' }) => {
  return (
    <div className={`spinner-container ${size}`}>
      <div 
        className="spinner" 
        style={{ borderTopColor: color }}
        role="status"
        aria-label="Cargando"
      ></div>
    </div>
  );
};

export default LoadingSpinner;
