import { useState, useCallback, useEffect } from 'react';
import AnalysisPanel from './AnalysisPanel';

export default function SortForm() {
  const [tab, setTab] = useState<'sort' | 'upload'>('sort');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 20 });
  const [summary, setSummary] = useState<object | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'upload') {
      setTab('upload');
    }
  }, []);

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
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <>
      <div className="tabbar">
        <button
          className={`tab ${tab === 'sort' ? 'tab-active' : ''}`}
          onClick={() => setTab('sort')}
        >
          Run a sort
        </button>
        <button
          className={`tab ${tab === 'upload' ? 'tab-active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload results
        </button>
      </div>

      {tab === 'sort' ? (
        renderSortTab()
      ) : (
        <div className="panel panel-body">
          <label className="field-label">Summary JSON</label>
          <input
            type="file"
            accept=".json"
            className="file"
            style={{ display: 'block', width: '100%' }}
            onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
          />
          {uploadFile && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: '0.5rem' }}>
              {uploadFile.name}
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && uploadFile && (
        <div style={{ marginTop: '1.5rem' }}>
          <AnalysisPanel source={uploadFile} />
        </div>
      )}
    </>
  );

  function renderSortTab() {
    return (
      <div className="panel panel-body">
        <label className="field-label">Labels</label>
        <textarea
          className="textarea"
          style={{ minHeight: '200px', marginBottom: '1.25rem' }}
          placeholder={'Enter labels, one per line or comma-separated:\n\nHome\nAbout\nContact\nBlog\nPricing'}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={loading || labels.length < 2}
          >
            {loading ? 'Running…' : 'Run Card Sort'}
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>
            {pad(labels.length)} label{labels.length !== 1 ? 's' : ''} detected
          </span>
        </div>

        {loading && (
          <div className="status">
            <div className="readout">
              <span>Sorting</span>
              <span className="muted">Agent {pad(progress.completed)} / {pad(progress.total)}</span>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {summary && (
          <div className="status">
            <div className="readout">
              <span>Card sort complete</span>
              <span className="muted">
                {(summary as any).total_agents} agents · {pad(labels.length)} labels
              </span>
            </div>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={handleDownload}>
              Download summary.json
            </button>
          </div>
        )}

        {summary && (
          <div style={{ marginTop: '2.5rem' }}>
            <div className="section-head">
              <p className="eyebrow">Analysis</p>
              <h2 className="section-title" style={{ marginTop: '0.5rem' }}>Analyze results</h2>
              <p className="section-sub">
                Build the similarity matrix to see the natural groupings, then extract clusters.
              </p>
            </div>
            <AnalysisPanel source={summary} />
          </div>
        )}
      </div>
    );
  }
}
