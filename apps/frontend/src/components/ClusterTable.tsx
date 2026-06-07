interface Cluster {
  cluster_id: number;
  labels: string[];
  size: number;
}

interface ClusterTableProps {
  clusters: Cluster[];
  names?: Record<number, string> | null;
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '0.7rem 1rem',
    borderBottom: '1px solid var(--ink)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.14em',
    color: 'var(--ink-soft)',
    fontWeight: 600,
  } as React.CSSProperties,
  td: {
    padding: '0.85rem 1rem',
    borderBottom: '1px solid var(--line-soft)',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  clusterId: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: '0.95rem',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  clusterName: {
    fontWeight: 700,
    fontSize: '1rem',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,
  size: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--ink-soft)',
    fontSize: '0.72rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginTop: '0.25rem',
  } as React.CSSProperties,
  pill: {
    display: 'inline-block',
    fontFamily: 'var(--font-mono)',
    border: '1px solid var(--ink)',
    background: 'var(--panel)',
    padding: '0.2rem 0.55rem',
    fontSize: '0.8rem',
    margin: '0.18rem',
  } as React.CSSProperties,
};

export default function ClusterTable({ clusters, names }: ClusterTableProps) {
  const pad = (n: number) => String(n).padStart(2, '0');

  const handleDownload = () => {
    const payload = clusters.map((cluster) => {
      const name = names?.[cluster.cluster_id];
      return {
        cluster_id: cluster.cluster_id,
        size: cluster.size,
        ...(name ? { generatedName: name } : {}),
        labels: cluster.labels,
      };
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clusters.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel" style={{ marginTop: '1.5rem' }}>
      <div className="panel-head">
        <span>Cluster Groups</span>
        <span>{pad(clusters.length)} clusters</span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '130px' }}>Cluster</th>
            <th style={styles.th}>Labels</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((cluster) => {
            const name = names?.[cluster.cluster_id];
            return (
            <tr key={cluster.cluster_id}>
              <td style={styles.td}>
                {name ? (
                  <>
                    <div style={styles.clusterName}>{name}</div>
                    <div style={styles.size}>C{pad(cluster.cluster_id)} · {cluster.size} labels</div>
                  </>
                ) : (
                  <>
                    <div style={styles.clusterId}>C{pad(cluster.cluster_id)}</div>
                    <div style={styles.size}>{cluster.size} labels</div>
                  </>
                )}
              </td>
              <td style={styles.td}>
                {cluster.labels.map((label, i) => (
                  <span key={i} style={styles.pill}>{label}</span>
                ))}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: '1.25rem', borderTop: '1px solid var(--ink)' }}>
        <button className="btn btn-accent" onClick={handleDownload}>
          Download clusters.json
        </button>
        <p className="section-sub" style={{ margin: '1rem 0 1.25rem' }}>
          <strong>NOTE:</strong> All results should be validated by tree-testing with <strong>REAL</strong> participants.
        </p>
      </div>
    </div>
  );
}
