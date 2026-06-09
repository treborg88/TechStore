import React from 'react';
import DatabaseManager from './DatabaseManager';

/**
 * Database settings section — PostgreSQL only
 * Shows connection status, credentials (read-only), and backup/restore.
 */
function DatabaseSection() {
  return (
    <section className="settings-section">
      <h3>🗄️ Base de Datos</h3>
      <p className="section-description">
        Gestión local de respaldos y restauración.
      </p>

      {/* Backup/Restore manager */}
      <DatabaseManager />
    </section>
  );
}

export default DatabaseSection;
