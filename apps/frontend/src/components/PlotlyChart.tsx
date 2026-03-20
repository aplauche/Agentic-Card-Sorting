import { useEffect, useRef } from 'react';

interface PlotlyChartProps {
  figure: { data: any[]; layout: any };
  style?: React.CSSProperties;
}

export default function PlotlyChart({ figure, style }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    import('plotly.js-dist-min').then((Plotly) => {
      if (mounted && containerRef.current) {
        Plotly.react(containerRef.current, figure.data, {
          ...figure.layout,
          autosize: true,
          height: Math.max(800, figure.layout?.height ?? 0),
        }, {
          responsive: true,
          displayModeBar: true,
        });
      }
    });

    return () => {
      mounted = false;
      if (containerRef.current) {
        import('plotly.js-dist-min').then((Plotly) => {
          if (containerRef.current) {
            Plotly.purge(containerRef.current);
          }
        });
      }
    };
  }, [figure]);

  return (
    <div
      ref={containerRef}
      style={style ?? { width: '100%', minHeight: '800px' }}
    />
  );
}
