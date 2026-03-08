interface Cluster {
  cluster_id: number;
  labels: string[];
  size: number;
}

interface ClusterTableProps {
  clusters: Cluster[];
}

const styles = {
  container: {
    background: 'white',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '0.75rem',
    borderBottom: '2px solid #1a1a2e',
    fontWeight: 600,
  } as React.CSSProperties,
  td: {
    padding: '0.75rem',
    borderBottom: '1px solid #eee',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  clusterName: {
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  size: {
    color: '#666',
    fontWeight: 'normal' as const,
    fontSize: '0.85rem',
  } as React.CSSProperties,
  pill: {
    display: 'inline-block',
    background: '#f0f4f8',
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.85rem',
    margin: '0.15rem',
  } as React.CSSProperties,
};

export default function ClusterTable({ clusters }: ClusterTableProps) {
  return (
    <div style={styles.container}>
      <h2 style={{ marginBottom: '1rem' }}>Cluster Groups</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        {clusters.length} clusters identified.
      </p>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '120px' }}>Cluster</th>
            <th style={styles.th}>Labels</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((cluster) => (
            <tr key={cluster.cluster_id}>
              <td style={styles.td}>
                <div style={styles.clusterName}>
                  Cluster {cluster.cluster_id}
                </div>
                <div style={styles.size}>{cluster.size} labels</div>
              </td>
              <td style={styles.td}>
                {cluster.labels.map((label, i) => (
                  <span key={i} style={styles.pill}>{label}</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
