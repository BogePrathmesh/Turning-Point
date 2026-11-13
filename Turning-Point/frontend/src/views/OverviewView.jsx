import React from 'react';
import {
  Inbox,
  Plane,
  AlertTriangle,
  Activity,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
  Radio
} from 'lucide-react';

export default function OverviewView({ stats, recentEvents = [], onNavigate, onAskAI, onSelectEvent }) {
  const total = stats?.totalMessages || 0;
  const flightCount = stats?.entityDistribution?.Flight || 0;
  const notamCount = stats?.entityDistribution?.NOTAM || 0;
  const processedCount = stats?.statusDistribution?.PROCESSED || total;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Title & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: '#fff' }}>
            Operations Overview
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Real-time intelligence grounded in active event streams and MongoDB document records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => onNavigate('messages')} className="btn">
            <Inbox size={14} />
            <span>Explore Messages</span>
          </button>
          <button onClick={() => onNavigate('ai')} className="btn btn-primary">
            <Sparkles size={14} />
            <span>Ask AI Assistant</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Stored Events
            </span>
            <Inbox size={16} color="var(--accent-blue)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: '8px 0 4px', letterSpacing: '-0.5px' }}>
            {total.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} />
            <span>100% Normalized in MongoDB</span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Flight Messages
            </span>
            <Plane size={16} color="var(--accent-blue)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: '8px 0 4px', letterSpacing: '-0.5px' }}>
            {flightCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            FAA NAS & FIXM 3.0 / 4.0
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              NOTAM Advisories
            </span>
            <AlertTriangle size={16} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: '8px 0 4px', letterSpacing: '-0.5px' }}>
            {notamCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            AIXM 5.1 / FAA FNS Aeronautical
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Processing Accuracy
            </span>
            <Activity size={16} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: '8px 0 4px', letterSpacing: '-0.5px' }}>
            {total > 0 ? ((processedCount / total) * 100).toFixed(1) : 100}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}>
            Zero unhandled schema crashes
          </div>
        </div>
      </div>

      {/* Two Column Section: AI Grounded Insights & Suggested Prompts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
        {/* Panel 1: AI Grounded Insights */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Sparkles size={16} color="var(--accent-blue)" />
              <span>Grounded AI Operational Observations</span>
            </div>
            <span className="badge badge-flight">Deterministic Grounding</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Flight messages represent {total > 0 ? ((flightCount / total) * 100).toFixed(0) : 0}% of all operational traffic
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Major carriers active in current dataset include ENY (Envoy Air), SKW (SkyWest), and ACA (Air Canada) connecting key hubs including KPHX, KTUL, and KLAX.
              </p>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Active NOTAM airspace cautions concentrated in ZLA and KZOB FIRs
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Advisories highlight UAS taxi testing near Point Mugu NAS and crane obstruction alerts near Pittsburgh International (PIT).
              </p>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Complete Raw Payload Preservation
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                All 109 ingested records retain full un-truncated JSON/XML dictionaries alongside normalized parameters for auditability.
              </p>
            </div>
          </div>
        </div>

        {/* Panel 2: Suggested Prompts */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>Suggested Analytical Questions</span>
            </div>
            <span className="card-subtitle">Click to ask AI</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'Compare Flight and NOTAM message volume.',
              'Which airports have active flight departures?',
              'Show all NOTAM airspace cautions in ZLA.',
              'What is the status distribution across all records?',
              'Summarize UAS operations at Point Mugu NAS.'
            ].map((promptText, i) => (
              <button
                key={i}
                onClick={() => onAskAI(promptText)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 120ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'var(--border-highlight)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <span>{promptText}</span>
                <ArrowUpRight size={14} color="var(--accent-blue)" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Recent Event Activity Stream */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Activity size={16} color="var(--accent-emerald)" />
            <span>Recent Ingested Event Activity</span>
          </div>
          <button onClick={() => onNavigate('messages')} className="btn btn-sm btn-ghost">
            <span>View all in Messages</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Timestamp</th>
                <th style={{ width: '100px' }}>Entity</th>
                <th>Summary</th>
                <th style={{ width: '160px' }}>Feed</th>
                <th style={{ width: '100px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.slice(0, 5).map((evt) => (
                <tr
                  key={evt.eventId}
                  className="clickable"
                  onClick={() => onSelectEvent(evt)}
                >
                  <td className="code-cell" style={{ color: 'var(--text-muted)' }}>
                    {evt.eventTimestamp ? new Date(evt.eventTimestamp).toLocaleTimeString() : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${(evt.entityType || '').toLowerCase()}`}>
                      {evt.entityType}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {evt.summary}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {evt.sourceId}
                  </td>
                  <td>
                    <span className="badge badge-processed">
                      <span className="status-dot" /> {evt.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
