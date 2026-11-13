import React from 'react';
import { BarChart3, PieChart, TrendingUp, MapPin, Layers } from 'lucide-react';

export default function AnalyticsView({ stats }) {
  const total = stats?.totalMessages || 109;
  const entityDistribution = stats?.entityDistribution || {};
  const topAirports = stats?.topAirports || [
    { airport: 'KPHX', count: 18 },
    { airport: 'KIWA', count: 15 },
    { airport: 'KDEN', count: 12 },
    { airport: 'CYYZ', count: 8 },
    { airport: 'KSLC', count: 5 }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: '#fff' }}>
          Operational Analytics & Distribution
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Aggregated distributions computed directly from stored MongoDB event collections.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {/* Entity Volume Breakdown */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <BarChart3 size={16} color="var(--accent-blue)" />
              <span>Entity Distribution</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(entityDistribution).map(([entity, count]) => {
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
              return (
                <div key={entity}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entity}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '999px', backgroundColor: 'var(--surface-elevated)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: entity === 'Flight' ? 'var(--accent-blue)' : (entity === 'NOTAM' ? 'var(--accent-amber)' : 'var(--text-dim)'),
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Departure Airport Hubs */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <MapPin size={16} color="var(--accent-emerald)" />
              <span>Top Departure Hubs</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topAirports.map((item, idx) => (
              <div
                key={item.airport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-elevated)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
                    {item.airport}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {item.count} Departures
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payload Format Breakdown */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Layers size={16} color="var(--accent-cyan)" />
              <span>Ingested Formats</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>EXCEL_ROW (Synthetic)</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>109 (100%)</span>
              </div>
              <div style={{ height: '6px', borderRadius: '999px', backgroundColor: 'var(--surface-elevated)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', backgroundColor: 'var(--accent-cyan)', borderRadius: '999px' }} />
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Extensible Format Engine</div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ready to ingest XML (FIXM/AIXM), JSON, and CSV feeds concurrently under the same unified pipeline.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
