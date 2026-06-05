import { useState, useCallback } from 'react';
import PlotlyChart from './PlotlyChart';
import ClusterTable from './ClusterTable';

const styles = {
  form: {
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '2rem',
  } as React.CSSProperties,
  row: {
    display: 'flex',
    gap: '1.5rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const,
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
  select: {
    padding: '0.6rem 0.8rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '0.95rem',
    background: 'white',
  } as React.CSSProperties,
  button: {
    background: '#1a1a2e',
    color: 'white',
    border: 'none',
    padding: '0.6rem 2rem',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 600,
  } as React.CSSProperties,
  buttonDisabled: {
    background: '#999',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  error: {
    color: '#d62728',
    marginTop: '1rem',
    padding: '1rem',
    background: '#fff5f5',
    borderRadius: '8px',
  } as React.CSSProperties,
  chartContainer: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '2rem',
  } as React.CSSProperties,
};

interface AnalysisResult {
  dendrogram: { data: any[]; layout: any };
  heatmap: { data: any[]; layout: any };
  clusters: Array<{ cluster_id: number; labels: string[]; size: number }>;
}

interface AnalysisPanelProps {
  /** A File (standalone upload) or the in-memory sort summary object. */
  source: File | object | null;
}

export default function AnalysisPanel({ source }: AnalysisPanelProps) {
  const [k, setK] = useState(8);
  const [linkage, setLinkage] = useState('ward');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!source) return;

    setLoading(true);
    setError('');

    try {
      const file =
        source instanceof File
          ? source
          : new File([JSON.stringify(source)], 'summary.json', {
              type: 'application/json',
            });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('k', k.toString());
      formData.append('linkage', linkage);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [source, k, linkage]);

  return (
    <>
      <div style={styles.form}>
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Clusters (k)</label>
            <input
              type="number"
              min={2}
              max={50}
              value={k}
              onChange={e => setK(parseInt(e.target.value) || 8)}
              style={{ ...styles.input, width: '80px' }}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Linkage</label>
            <select
              value={linkage}
              onChange={e => setLinkage(e.target.value)}
              style={styles.select}
            >
              <option value="ward">Ward</option>
              <option value="average">Average</option>
              <option value="complete">Complete</option>
              <option value="single">Single</option>
            </select>
          </div>
          <button
            style={{ ...styles.button, ...(loading || !source ? styles.buttonDisabled : {}) }}
            onClick={runAnalysis}
            disabled={loading || !source}
          >
            {loading ? 'Analyzing...' : result ? 'Re-run' : 'Analyze'}
          </button>
        </div>
        {error && <div style={styles.error}>{error}</div>}
      </div>

      {result && (
        <>
          <div style={styles.chartContainer}>
            <PlotlyChart figure={result.dendrogram} style={{ width: '100%', minHeight: '800px' }} />
          </div>
          <div style={styles.chartContainer}>
            <PlotlyChart figure={result.heatmap} style={{ width: '100%', minHeight: '700px' }} />
          </div>
          <ClusterTable clusters={result.clusters} />
        </>
      )}
    </>
  );
}
