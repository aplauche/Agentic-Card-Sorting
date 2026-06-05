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
  hint: {
    fontSize: '0.85rem',
    color: '#666',
    margin: '0 0 1rem',
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

interface MatrixResult {
  dendrogram: { data: any[]; layout: any };
  heatmap: { data: any[]; layout: any };
}

type Cluster = { cluster_id: number; labels: string[]; size: number };

interface AnalysisPanelProps {
  /** A File (standalone upload) or the in-memory sort summary object. */
  source: File | object | null;
}

export default function AnalysisPanel({ source }: AnalysisPanelProps) {
  const [linkage, setLinkage] = useState('ward');
  const [k, setK] = useState(8);
  const [matrix, setMatrix] = useState<MatrixResult | null>(null);
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [error, setError] = useState('');

  const sourceAsFile = useCallback((): File => {
    if (source instanceof File) return source;
    return new File([JSON.stringify(source)], 'summary.json', {
      type: 'application/json',
    });
  }, [source]);

  const computeMatrix = useCallback(async () => {
    if (!source) return;

    setMatrixLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', sourceAsFile());
      formData.append('linkage', linkage);

      const response = await fetch('/api/matrix', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text}`);
      }

      setMatrix(await response.json());
      // The linkage may have changed, so any prior clusters are now stale.
      setClusters(null);
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setMatrixLoading(false);
    }
  }, [source, linkage, sourceAsFile]);

  const computeClusters = useCallback(async () => {
    if (!source) return;

    setClusterLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', sourceAsFile());
      formData.append('k', k.toString());
      formData.append('linkage', linkage);

      const response = await fetch('/api/clusters', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text}`);
      }

      const data = await response.json();
      setClusters(data.clusters);
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setClusterLoading(false);
    }
  }, [source, k, linkage, sourceAsFile]);

  return (
    <>
      {/* Step 1: similarity matrix */}
      <div style={styles.form}>
        <p style={styles.hint}>
          Build the similarity matrix first to see how many clusters naturally emerge,
          then choose a value for k below.
        </p>
        <div style={styles.row}>
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
            style={{ ...styles.button, ...(matrixLoading || !source ? styles.buttonDisabled : {}) }}
            onClick={computeMatrix}
            disabled={matrixLoading || !source}
          >
            {matrixLoading
              ? 'Building...'
              : matrix
              ? 'Rebuild matrix'
              : 'Build similarity matrix'}
          </button>
        </div>
        {error && <div style={styles.error}>{error}</div>}
      </div>

      {matrix && (
        <>
          <div style={styles.chartContainer}>
            <PlotlyChart figure={matrix.heatmap} style={{ width: '100%', minHeight: '700px' }} />
          </div>
          <div style={styles.chartContainer}>
            <PlotlyChart figure={matrix.dendrogram} style={{ width: '100%', minHeight: '800px' }} />
          </div>

          {/* Step 2: extract clusters at a chosen k */}
          <div style={styles.form}>
            <p style={styles.hint}>
              Based on the matrix above, pick how many clusters to extract.
            </p>
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
              <button
                style={{ ...styles.button, ...(clusterLoading ? styles.buttonDisabled : {}) }}
                onClick={computeClusters}
                disabled={clusterLoading}
              >
                {clusterLoading
                  ? 'Clustering...'
                  : clusters
                  ? 'Update clusters'
                  : 'Show clusters'}
              </button>
            </div>
          </div>

          {clusters && <ClusterTable clusters={clusters} />}
        </>
      )}
    </>
  );
}
