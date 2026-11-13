import React, { useState } from 'react';
import { X, Copy, Check, Download, Sparkles, Plane, AlertTriangle, FileCode } from 'lucide-react';

export default function Drawer({ event, onClose, onAskAI }) {
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(event.rawPayload || event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const data = JSON.stringify(event, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.eventId || 'event'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFlight = event.entityType === 'Flight';
  const isNotam = event.entityType === 'NOTAM';

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: isFlight ? 'var(--accent-blue-dim)' : 'var(--accent-amber-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isFlight ? 'var(--accent-blue)' : 'var(--accent-amber)'
            }}>
              {isFlight ? <Plane size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                {event.summary || `${event.entityType} Event Details`}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {event.eventId}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {/* Metadata Grid */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Core Metadata
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              backgroundColor: 'var(--surface-elevated)',
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entity Type</span>
                <div style={{ marginTop: '2px' }}>
                  <span className={`badge badge-${(event.entityType || '').toLowerCase()}`}>
                    {event.entityType}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Processing Status</span>
                <div style={{ marginTop: '2px' }}>
                  <span className="badge badge-processed">
                    <span className="status-dot" /> {event.status}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Event Timestamp</span>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {event.eventTimestamp ? new Date(event.eventTimestamp).toUTCString() : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingestion Received</span>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {event.receivedAt ? new Date(event.receivedAt).toLocaleTimeString() : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Source Feed</span>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {event.sourceId || 'feed_synthetic_excel'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Source File / Sheet</span>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {event.ingestionMetadata?.sourceFile ? `${event.ingestionMetadata.sourceFile} [Row ${event.ingestionMetadata.rowIndex}]` : 'Synthetic Feed'}
                </div>
              </div>
            </div>
          </div>

          {/* Domain Normalized Fields */}
          {event.normalized && Object.keys(event.normalized).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Normalized Intelligence Fields
              </div>
              <div style={{
                backgroundColor: 'var(--surface-elevated)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden'
              }}>
                {Object.entries(event.normalized).map(([k, v], idx) => {
                  if (v === null || v === undefined) return null;
                  return (
                    <div
                      key={k}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '150px 1fr',
                        padding: '10px 14px',
                        borderBottom: idx < Object.keys(event.normalized).length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                        {k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                      <span style={{ color: '#fff', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                        {String(v)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Raw Payload Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Original Preserved Payload
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCopy} className="btn btn-sm btn-ghost">
                  {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button onClick={handleDownload} className="btn btn-sm btn-ghost">
                  <Download size={12} />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <pre className="json-viewer">
              {JSON.stringify(event.rawPayload || event.normalized || {}, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-default)',
          backgroundColor: 'var(--surface-elevated)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button onClick={onClose} className="btn">
            Close
          </button>
          <button
            onClick={() => onAskAI(`Analyze this ${event.entityType} event: "${event.summary}"`)}
            className="btn btn-primary"
          >
            <Sparkles size={14} />
            <span>Analyze with AI Assistant</span>
          </button>
        </div>
      </div>
    </div>
  );
}
