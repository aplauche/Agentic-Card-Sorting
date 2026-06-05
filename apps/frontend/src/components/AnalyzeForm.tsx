import { useState, useRef } from 'react';
import AnalysisPanel from './AnalysisPanel';

const styles = {
  form: {
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '2rem',
  } as React.CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  } as React.CSSProperties,
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#444',
  } as React.CSSProperties,
  input: {
    padding: '0.6rem 0.8rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '0.95rem',
  } as React.CSSProperties,
  fileName: {
    fontSize: '0.85rem',
    color: '#666',
    marginTop: '0.25rem',
  } as React.CSSProperties,
};

export default function AnalyzeForm() {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Summary JSON</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={styles.input}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          {file && <div style={styles.fileName}>{file.name}</div>}
        </div>
      </div>

      <AnalysisPanel source={file} />
    </>
  );
}
