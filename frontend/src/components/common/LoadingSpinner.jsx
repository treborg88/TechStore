import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', color = '#3498db', fullPage = false, message = '' }) => {
  const spinner = (
    <div className={`spinner-container ${size}`}>
      <div 
        className="spinner" 
        style={{ borderTopColor: color }}
        role="status"
        aria-label="Cargando"
      ></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="full-page-spinner-overlay">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
