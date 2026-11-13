import React, { useState, useEffect, useCallback } from 'react';
import { Radio, Database, Plus, CheckCircle2, AlertCircle, Settings, X, RefreshCw } from 'lucide-react';

export default function SourcesView({ stats, health }) {
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [solaceInfo, setSolaceInfo] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);

  const fetchSolaceStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/solace/status');
      if (res.ok) {
        const data = await res.json();
        setSolaceInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch Solace status:', err);
    }
  }, []);

  useEffect(() => {
    fetchSolaceStatus();
  }, [fetchSolaceStatus]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestFeedback(null);
    try {
      const res = await fetch('/api/solace/test-connection', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.connected) {
        setTestFeedback({ ok: true, message: `Connected in ${data.latencyMs}ms (${data.vpn})` });
        await fetchSolaceStatus();
      } else {
        setTestFeedback({ ok: false, message: data.detail || 'Connection test failed' });
      }
    } catch (err) {
      setTestFeedback({ ok: false, message: String(err) });
    } finally {
      setIsTesting(false);
    }
  };

  const isConnected = solaceInfo?.status === 'Connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: '#fff' }}>
            Event Brokers & Data Sources
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Configure and monitor enterprise event brokers, message queues, and persistent storage connections.
          </p>
        </div>
        <button onClick={() => setShowBrokerModal(true)} className="btn btn-primary">
          <Plus size={14} />
          <span>Inspect Solace Config</span>
        </button>
      </div>

      {/* Sources Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Source 1: Solace PubSub+ Cloud Broker */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: isConnected ? 'var(--accent-emerald-dim)' : 'var(--accent-amber-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConnected ? 'var(--accent-emerald)' : 'var(--accent-amber)'
            }}>
              <Radio size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  {solaceInfo?.serviceName || 'MyFirstSolaceBroker'} (Solace Cloud)
                </span>
                <span className={`badge ${isConnected ? 'badge-processed' : 'badge-warning'}`}>
                  <span className="status-dot" /> {solaceInfo?.status || 'Checking...'}
                </span>
                <span className="badge badge-flight">
                  {solaceInfo?.ingestedEventsCount ?? 0} Live Events
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {solaceInfo?.host || 'tcps://...'} · VPN: {solaceInfo?.vpn || '...'} · {solaceInfo?.destinationType || 'Topic'}: {solaceInfo?.destination || '...'}
              </div>
              {testFeedback && (
                <div style={{
                  fontSize: '12px',
                  marginTop: '6px',
                  color: testFeedback.ok ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {testFeedback.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  <span>{testFeedback.message}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleTestConnection} disabled={isTesting} className="btn btn-sm btn-primary">
              <RefreshCw size={13} className={isTesting ? 'spin' : ''} />
              <span>{isTesting ? 'Testing TLS...' : 'Test Connection'}</span>
            </button>
            <button onClick={() => setShowBrokerModal(true)} className="btn btn-sm">
              <Settings size={14} />
              <span>View Details</span>
            </button>
          </div>
        </div>

        {/* Source 2: Local MongoDB Cluster */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-emerald-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald)'
            }}>
              <Database size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  MongoDB Document Store (Local Cluster)
                </span>
                <span className="badge badge-processed">
                  <span className="status-dot" /> {health?.database === 'connected' ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Endpoint: mongodb://127.0.0.1:27017 · Database: eventinsight_ai · 5 active compound indexes
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              {stats?.totalMessages || 0} Events
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Zero latency local socket
            </div>
          </div>
        </div>

        {/* Source 3: Synthetic Excel Feed */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-blue-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)'
            }}>
              <Radio size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  Synthetic Aviation Ingestion Feed
                </span>
                <span className="badge badge-flight">
                  11 Workbooks Ingested
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Path: dataset/xlsx_data/Workbook*.xlsx · Ingested & Normalized via Python Normalization Engine
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span className="badge badge-processed">
              <CheckCircle2 size={12} /> Sync Complete
            </span>
          </div>
        </div>
      </div>

      {/* Solace Modal (Read-only masked view from .env) */}
      {showBrokerModal && (
        <div className="drawer-backdrop" onClick={() => setShowBrokerModal(false)}>
          <div
            className="card"
            style={{ width: 'min(640px, 95vw)', margin: 'auto', backgroundColor: 'var(--surface-elevated)', zIndex: 60 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <div className="card-title">
                <Radio size={16} color="var(--accent-blue)" />
                <span>Solace Event Broker Configuration (.env)</span>
              </div>
              <button onClick={() => setShowBrokerModal(false)} className="btn btn-ghost btn-sm">
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Credentials are securely loaded from your local <code>.env</code> file on the server and masked in the UI.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Service Name</label>
                <input type="text" className="input-control" value={solaceInfo?.serviceName || ''} readOnly style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Secured SMF URI</label>
                <input type="text" className="input-control" value={solaceInfo?.host || ''} readOnly style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Message VPN</label>
                <input type="text" className="input-control" value={solaceInfo?.vpn || ''} readOnly style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Protocol</label>
                <input type="text" className="input-control" value={solaceInfo?.protocol || ''} readOnly style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Client Username</label>
                <input type="text" className="input-control" value={solaceInfo?.username || ''} readOnly style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Client Password</label>
                <input type="password" className="input-control" value={solaceInfo?.passwordMasked || '••••••••••••'} readOnly style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Destination Type</label>
                <input type="text" className="input-control" value={solaceInfo?.destinationType || ''} readOnly style={{ marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Topic / Queue Pattern</label>
                <input type="text" className="input-control" value={solaceInfo?.destination || ''} readOnly style={{ marginTop: '4px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowBrokerModal(false)} className="btn">
                Close
              </button>
              <button onClick={handleTestConnection} disabled={isTesting} className="btn btn-primary">
                {isTesting ? 'Testing...' : 'Test Live TLS Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
