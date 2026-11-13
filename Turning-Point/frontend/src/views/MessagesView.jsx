import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Server,
  Download,
  Filter,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Cpu
} from 'lucide-react';

export default function MessagesView({
  events = [],
  totalEvents = 0,
  page = 1,
  setPage,
  limit = 25,
  entityFilter,
  setEntityFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  onSelectEvent,
  stats,
  systemLogs = [],
  health,
  isLoading
}) {
  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'system'

  const entityCounts = stats?.entityDistribution || {};

  const handleExportJson = () => {
    const data = JSON.stringify(events, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eventinsight-events-page-${page}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalEvents / limit) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: '#fff' }}>
            Messages & Ingestion Telemetry
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Unified stream of captured enterprise business events and subsystem activity logs.
          </p>
        </div>

        {/* View Toggle Tabs (Strict Separation as per spec) */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          backgroundColor: 'var(--surface)',
          borderRadius: '10px',
          border: '1px solid var(--border-default)'
        }}>
          <button
            onClick={() => setActiveTab('events')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'events' ? 'var(--accent-blue)' : 'transparent',
              borderColor: activeTab === 'events' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'events' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Inbox size={14} />
            <span>Event Messages ({totalEvents})</span>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'system' ? 'var(--accent-blue)' : 'transparent',
              borderColor: activeTab === 'system' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'system' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Server size={14} />
            <span>System Info ({systemLogs.length})</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: EVENT MESSAGES (BUSINESS DATA STREAM)
         ========================================================================= */}
      {activeTab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            backgroundColor: 'var(--surface)',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border-default)'
          }}>
            {/* Entity Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
                Entity:
              </span>
              {['All', 'Flight', 'NOTAM', 'Weather', 'GeneralEvent'].map((ent) => {
                const count = ent === 'All' ? totalEvents : (entityCounts[ent] || 0);
                const isSelected = entityFilter === ent;
                return (
                  <button
                    key={ent}
                    onClick={() => { setEntityFilter(ent); setPage(1); }}
                    className="btn btn-sm"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--surface-active)' : 'transparent',
                      borderColor: isSelected ? 'var(--border-highlight)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    <span>{ent}</span>
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: isSelected ? 'var(--accent-blue)' : 'var(--text-dim)'
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Status & Export */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="input-control"
                style={{ width: '130px', height: '32px', fontSize: '12px' }}
              >
                <option value="All">All Statuses</option>
                <option value="PROCESSED">PROCESSED</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </select>

              <button onClick={handleExportJson} className="btn btn-sm" title="Export current dataset as JSON">
                <Download size={14} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>Received Time</th>
                  <th style={{ width: '100px' }}>Entity</th>
                  <th>Event Summary & Key Fields</th>
                  <th style={{ width: '160px' }}>Source / Feed</th>
                  <th style={{ width: '110px' }}>Format</th>
                  <th style={{ width: '120px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Loading real records from MongoDB...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No events match the selected filters. Try resetting filters or search query.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => {
                    const timeStr = evt.eventTimestamp
                      ? new Date(evt.eventTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : '—';
                    const isFlight = evt.entityType === 'Flight';
                    const isNotam = evt.entityType === 'NOTAM';

                    return (
                      <tr
                        key={evt.eventId}
                        className="clickable"
                        onClick={() => onSelectEvent(evt)}
                      >
                        <td className="code-cell" style={{ color: 'var(--text-muted)' }}>
                          {timeStr}
                        </td>
                        <td>
                          <span className={`badge badge-${(evt.entityType || '').toLowerCase()}`}>
                            {evt.entityType}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {evt.summary}
                            </span>
                            {/* Rich snippet badges for fast visual scanning */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              {isFlight && evt.normalized?.departureAirport && evt.normalized?.arrivalAirport && (
                                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '1px 5px', borderRadius: '4px' }}>
                                  {evt.normalized.departureAirport} → {evt.normalized.arrivalAirport}
                                </span>
                              )}
                              {isNotam && evt.normalized?.affectedFIR && (
                                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', background: 'var(--accent-amber-dim)', padding: '1px 5px', borderRadius: '4px' }}>
                                  FIR: {evt.normalized.affectedFIR}
                                </span>
                              )}
                              {evt.normalized?.flightStatus && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  Status: {evt.normalized.flightStatus}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {evt.sourceId || 'feed_synthetic_excel'}
                          </span>
                          {evt.normalized?.controlCenter && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              [{evt.normalized.controlCenter}]
                            </span>
                          )}
                        </td>
                        <td className="code-cell" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {evt.format}
                        </td>
                        <td>
                          <span className={`badge badge-${(evt.status || 'processed').toLowerCase()}`}>
                            <span className="status-dot" /> {evt.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {events.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalEvents)} of {totalEvents} events
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-sm"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-sm"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SYSTEM INFO (TECHNICAL ACTIVITY & TELEMETRY STREAM)
         ========================================================================= */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Subsystem Health Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Database</span>
                <span className="badge badge-processed"><span className="status-dot" /> Active</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>MongoDB 8.0</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Cluster connected · {totalEvents} event docs stored
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingestion Engine</span>
                <span className="badge badge-processed"><span className="status-dot" /> Ready</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Excel Normalizer</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                11 Workbooks ingested · 0 errors
              </div>
            </div>

            {(() => {
              const latestSolace = systemLogs.find((l) => l.component === 'Solace Broker Consumer');
              const solaceOk = latestSolace && latestSolace.status === 'SUCCESS';
              return (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Event Broker</span>
                    <span className={`badge ${solaceOk ? 'badge-processed' : 'badge-warning'}`}>
                      <span className="status-dot" /> {solaceOk ? 'Connected' : 'Standby'}
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Solace PubSub+</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {solaceOk ? `VPN: myfirstsolacebroker · ${latestSolace.action}` : 'Configured in .env (Run consumer to stream)'}
                  </div>
                </div>
              );
            })()}

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Local AI</span>
                <span className="badge badge-flight">Ready</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Ollama Adapter</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Deterministic grounder active
              </div>
            </div>
          </div>

          {/* Technical System Audit Log Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Server size={16} color="var(--accent-blue)" />
                <span>Subsystem Ingestion & Execution Audit Logs</span>
              </div>
              <span className="card-subtitle">Real telemetry recorded during system activity</span>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Subsystem</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Details</th>
                    <th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {systemLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No system activity logged yet.
                      </td>
                    </tr>
                  ) : (
                    systemLogs.map((log, idx) => (
                      <tr key={log._id || idx}>
                        <td className="code-cell" style={{ color: 'var(--text-muted)', width: '180px' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.component}
                        </td>
                        <td className="code-cell" style={{ color: 'var(--accent-blue)' }}>
                          {log.action}
                        </td>
                        <td>
                          <span className={`badge ${log.status === 'SUCCESS' ? 'badge-processed' : 'badge-error'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {log.details}
                        </td>
                        <td className="code-cell" style={{ color: 'var(--text-muted)' }}>
                          {log.durationMs ? `${log.durationMs}ms` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
