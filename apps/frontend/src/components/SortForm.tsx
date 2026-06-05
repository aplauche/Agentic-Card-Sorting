import { useState, useCallback } from 'react';
import AnalysisPanel from './AnalysisPanel';

const styles = {
  form: {
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    minHeight: '200px',
    padding: '1rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    resize: 'vertical' as const,
    marginBottom: '1rem',
  } as React.CSSProperties,
  button: {
    background: '#1a1a2e',
    color: 'white',
    border: 'none',
    padding: '0.75rem 2rem',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 600,
  } as React.CSSProperties,
  buttonDisabled: {
    background: '#999',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  progress: {
    marginTop: '1.5rem',
    padding: '1rem',
    background: '#f0f4f8',
    borderRadius: '8px',
  } as React.CSSProperties,
  progressBar: {
    height: '8px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '0.5rem',
  } as React.CSSProperties,
  downloadBtn: {
    background: '#2ca02c',
    color: 'white',
    border: 'none',
    padding: '0.75rem 2rem',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 600,
    marginTop: '1rem',
  } as React.CSSProperties,
  error: {
    color: '#d62728',
    marginTop: '1rem',
    padding: '1rem',
    background: '#fff5f5',
    borderRadius: '8px',
  } as React.CSSProperties,
};

export default function SortForm() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 20 });
  const [summary, setSummary] = useState<object | null>(null);
  const [error, setError] = useState('');

  const parseLabels = (text: string): string[] => {
    // Split by newline first, then by comma, trim and filter empties
    const lines = text.split('\n');
    const labels: string[] = [];
    for (const line of lines) {
      if (line.includes(',')) {
        labels.push(...line.split(',').map(s => s.trim()).filter(Boolean));
      } else if (line.trim()) {
        labels.push(line.trim());
      }
    }
    return labels;
  };

  const handleSubmit = useCallback(async () => {
    const labels = parseLabels(input);
    if (labels.length < 2) {
      setError('Please enter at least 2 labels.');
      return;
    }

    setLoading(true);
    setError('');
    setSummary(null);
    setProgress({ completed: 0, total: 20 });

    try {
      const response = await fetch('/api/sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.trim().split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) eventData = line.slice(6);
          }

          if (!eventType || !eventData) continue;
          const data = JSON.parse(eventData);

          if (eventType === 'progress') {
            setProgress({ completed: data.completed, total: data.total });
          } else if (eventType === 'complete') {
            setSummary(data);
          } else if (eventType === 'error') {
            setError(data.message);
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleDownload = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'summary.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const labels = parseLabels(input);

  return (
    <div style={styles.form}>
      <textarea
        style={styles.textarea}
        placeholder={"Enter labels, one per line or comma-separated:\n\nHome\nAbout\nContact\nBlog\nPricing"}
        value={input}
        onChange={e => setInput(e.target.value)}
        disabled={loading}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          style={{ ...styles.button, ...(loading || labels.length < 2 ? styles.buttonDisabled : {}) }}
          onClick={handleSubmit}
          disabled={loading || labels.length < 2}
        >
          {loading ? 'Running...' : 'Run Card Sort'}
        </button>
        <span style={{ color: '#666', fontSize: '0.9rem' }}>
          {labels.length} label{labels.length !== 1 ? 's' : ''} detected
        </span>
      </div>

      {loading && (
        <div style={styles.progress}>
          <div>Agent {progress.completed} of {progress.total} complete</div>
          <div style={styles.progressBar}>
            <div
              style={{
                height: '100%',
                width: `${(progress.completed / progress.total) * 100}%`,
                background: '#1a5276',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {summary && (
        <div style={styles.progress}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Card sort complete!</div>
          <div style={{ color: '#666', marginBottom: '0.5rem' }}>
            {(summary as any).total_agents} agents sorted {labels.length} labels.
          </div>
          <button style={styles.downloadBtn} onClick={handleDownload}>
            Download summary.json
          </button>
        </div>
      )}

      {summary && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Analyze Results</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Build the similarity matrix to see the natural groupings, then extract clusters.
          </p>
          <AnalysisPanel source={summary} />
        </div>
      )}
    </div>
  );
}
