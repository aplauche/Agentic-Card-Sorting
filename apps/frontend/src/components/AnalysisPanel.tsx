import { useState, useCallback } from 'react';
import PlotlyChart from './PlotlyChart';
import ClusterTable from './ClusterTable';

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
      <div className="panel panel-body">
        <p className="section-sub" style={{ margin: '0 0 1.25rem' }}>
          Build the similarity matrix first to see how many clusters naturally
          emerge, then choose a value for k below.
        </p>
        <div className="controls-row">
          <div className="field">
            <label className="field-label">Linkage</label>
            <select
              className="select"
              value={linkage}
              onChange={e => setLinkage(e.target.value)}
            >
              <option value="ward">Ward</option>
              <option value="average">Average</option>
              <option value="complete">Complete</option>
              <option value="single">Single</option>
            </select>
          </div>
          <button className="btn" onClick={computeMatrix} disabled={matrixLoading || !source}>
            {matrixLoading ? 'Building…' : matrix ? 'Rebuild matrix' : 'Build similarity matrix'}
          </button>
        </div>
        {error && (
          <div className="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {matrix && (
        <>
          <div className="panel" style={{ marginTop: '1.5rem' }}>
            <div className="panel-head"><span>Similarity Matrix</span><span>{linkage.toUpperCase()}</span></div>
            <div style={{ padding: '0.75rem' }}>
              <PlotlyChart figure={matrix.heatmap} style={{ width: '100%', minHeight: '700px' }} />
            </div>
          </div>
          <div className="panel" style={{ marginTop: '1.5rem' }}>
            <div className="panel-head"><span>Dendrogram</span><span>{linkage.toUpperCase()}</span></div>
            <div style={{ padding: '0.75rem' }}>
              <PlotlyChart figure={matrix.dendrogram} style={{ width: '100%', minHeight: '800px' }} />
            </div>
          </div>

          {/* Step 2: extract clusters at a chosen k */}
          <div className="panel panel-body" style={{ marginTop: '1.5rem' }}>
            <p className="section-sub" style={{ margin: '0 0 1.25rem' }}>
              Based on the matrix above, pick how many clusters to extract.
            </p>
            <div className="controls-row">
              <div className="field">
                <label className="field-label">Clusters (k)</label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={k}
                  onChange={e => setK(parseInt(e.target.value) || 8)}
                  className="input"
                  style={{ width: '90px' }}
                />
              </div>
              <button className="btn" onClick={computeClusters} disabled={clusterLoading}>
                {clusterLoading ? 'Clustering…' : clusters ? 'Update clusters' : 'Show clusters'}
              </button>
            </div>
          </div>

          {clusters && <ClusterTable clusters={clusters} />}
        </>
      )}
    </>
  );
}
