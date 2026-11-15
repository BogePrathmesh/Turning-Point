import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Plane,
  AlertTriangle,
  Layers,
  CloudRain,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';

/**
 * Lightweight, deterministic Markdown renderer for chat messages.
 * Formats tables, bold text, inline code, and blockquotes cleanly.
 */
function FormattedMessage({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let tableRows = [];
  let inTable = false;

  const renderInline = (str) => {
    // Replace markdown bold, code, and math arrows
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\$\\rightarrow\$|\$\\longrightarrow\$)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={match.index} style={{ color: '#fff', fontWeight: 600 }}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--accent-blue)',
              padding: '1px 5px',
              borderRadius: '4px',
              border: '1px solid rgba(59, 130, 246, 0.25)'
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.includes('rightarrow')) {
        parts.push(' → ');
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  const flushTable = (key) => {
    if (tableRows.length === 0) return null;
    const isHeader = (r) => r.every((c) => c.match(/^[:\-\s]+$/));
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(1).filter((r) => !isHeader(r));

    const tableEl = (
      <div key={`table-${key}`} style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table className="data-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              {headerRow.map((cell, cIdx) => (
                <th key={cIdx} style={{ padding: '6px 10px', fontSize: '11px' }}>
                  {renderInline(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} style={{ padding: '6px 10px' }}>
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
    return tableEl;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect markdown table rows
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      const cells = line.trim().split('|').slice(1, -1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      elements.push(flushTable(i));
    }

    if (line.startsWith('> ')) {
      elements.push(
        <div
          key={i}
          style={{
            borderLeft: '3px solid var(--accent-blue)',
            paddingLeft: '10px',
            margin: '8px 0',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontStyle: 'italic'
          }}
        >
          {renderInline(line.slice(2))}
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '6px', margin: '3px 0', paddingLeft: '8px' }}>
          <span style={{ color: 'var(--accent-blue)' }}>•</span>
          <span style={{ flex: 1 }}>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={i} style={{ margin: '4px 0', paddingLeft: '8px' }}>
          {renderInline(line)}
        </div>
      );
    } else if (line.trim()) {
      elements.push(
        <p key={i} style={{ margin: '6px 0' }}>
          {renderInline(line)}
        </p>
      );
    }
  }

  if (inTable) {
    elements.push(flushTable(lines.length));
  }

  return <div>{elements}</div>;
}

export default function AIAssistantView({ initialPrompt = '', stats, events = [] }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "**Hello! I am your EventInsight AI Operational Assistant.**\n\nI have direct access to your normalized MongoDB events. You can ask me about flight departures, schedules, delays, NOTAM airspace advisories, or live system health.",
      grounded: true,
      suggestedFollowUps: [
        "When is my flight going?",
        "Status of flight AI203",
        "Which flights are delayed?",
        "Show all NOTAMs"
      ]
    }
  ]);
  const [input, setInput] = useState(initialPrompt);
  const [selectedEntities, setSelectedEntities] = useState(['Flight', 'NOTAM']);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle auto-running initialPrompt if provided
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      handleQuery(initialPrompt.trim());
    }
  }, [initialPrompt]);

  const toggleEntity = (ent) => {
    if (selectedEntities.includes(ent)) {
      setSelectedEntities(selectedEntities.filter((e) => e !== ent));
    } else {
      setSelectedEntities([...selectedEntities, ent]);
    }
  };

  const handleQuery = async (queryText) => {
    const q = (queryText || input).trim();
    if (!q || isLoading) return;

    // Add user message to UI immediately
    const userMsg = { role: 'user', text: q, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          contextEntities: selectedEntities,
          orgId: 'org_turning_point_default'
        })
      });

      if (response.ok) {
        const result = await response.json();
        const botMsg = {
          role: 'assistant',
          text: result.answer,
          intent: result.intent,
          rule: result.rule,
          recordsCount: result.recordsCount,
          grounded: result.grounded,
          suggestedFollowUps: result.suggestedFollowUps || [],
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errData = await response.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `⚠️ **Operational Query Error:** ${errData.detail || 'Could not reach AI rule engine on backend server.'}`,
            grounded: false
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ **Network Error:** Failed to connect to FastAPI server on port 8000 (${err.message}). Please ensure the backend is running.`,
          grounded: false
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: '20px', minHeight: 'calc(100vh - 160px)' }}>
      {/* Left Context Scope Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-header">
          <div className="card-title">
            <Layers size={16} color="var(--accent-blue)" />
            <span>Context Scope</span>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Active entity domains grounded in MongoDB:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { id: 'Flight', label: 'Flight Messages', icon: Plane, count: stats?.entityDistribution?.Flight || 38 },
            { id: 'NOTAM', label: 'NOTAM Advisories', icon: AlertTriangle, count: stats?.entityDistribution?.NOTAM || 32 },
            { id: 'Weather', label: 'Weather Feeds', icon: CloudRain, count: stats?.entityDistribution?.Weather || 1 },
            { id: 'GeneralEvent', label: 'General / Supplemental', icon: Layers, count: stats?.entityDistribution?.GeneralEvent || 29 },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = selectedEntities.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggleEntity(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--border-highlight)' : 'var(--border-subtle)',
                  backgroundColor: isSelected ? 'var(--surface-active)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={14} color={isSelected ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                  <span>{item.label}</span>
                </div>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          marginTop: 'auto',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--accent-emerald)' }}>
            <CheckCircle2 size={13} />
            <span>Rule-Based NLU Active</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Zero hallucination. All answers verified directly against live database collections.
          </p>
        </div>
      </div>

      {/* Center Chat Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {/* Chat Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--accent-blue-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)'
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>EventInsight AI Grounded Assistant</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rule-Based Engine · MongoDB Direct Factual Execution</div>
            </div>
          </div>
          <span className="badge badge-processed">
            <span className="status-dot" /> Online
          </span>
        </div>

        {/* Messages Body */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: m.role === 'user' ? '70%' : '88%',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: m.role === 'user' ? 'var(--accent-blue)' : 'var(--surface-elevated)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {m.role === 'user' ? m.text : <FormattedMessage content={m.text} />}
              </div>

              {/* Bot Meta pill & Follow-ups */}
              {m.role === 'assistant' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
                  {m.intent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      <span>Rule: {m.rule}</span>
                      <span>•</span>
                      <span>Intent: {m.intent}</span>
                      {m.recordsCount !== undefined && (
                        <>
                          <span>•</span>
                          <span>Records: {m.recordsCount}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Dynamic Follow-up Suggestions */}
                  {m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {m.suggestedFollowUps.map((promptText, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleQuery(promptText)}
                          className="btn btn-sm"
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            background: 'var(--surface)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <span>{promptText}</span>
                          <ArrowRight size={10} color="var(--accent-blue)" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Typing / Processing Indicator */}
          {isLoading && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}
            >
              <Sparkles size={14} className="spin" color="var(--accent-blue)" />
              <span>Querying MongoDB factual records via Rule Engine...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-default)',
          backgroundColor: 'var(--surface-elevated)',
          display: 'flex',
          gap: '10px'
        }}>
          <input
            type="text"
            className="input-control"
            placeholder="Ask about your flights, delays, NOTAM cautions, airport activity..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuery();
            }}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => handleQuery()}
            disabled={isLoading || !input.trim()}
            className="btn btn-primary"
          >
            <Send size={14} />
            <span>Ask</span>
          </button>
        </div>
      </div>

      {/* Right Suggested Prompts Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card-header">
          <div className="card-title">
            <HelpCircle size={15} color="var(--accent-blue)" />
            <span>Recommended Queries</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            'When my flight is going',
            'Status of flight AI203',
            'Which flights are delayed?',
            'Show flights departing KPHX',
            'Show all NOTAM airspace cautions in ZLA',
            'What is the weather at CYYZ?',
            'Compare Flight and NOTAM message volume.',
            'Is the Solace broker connected?'
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleQuery(prompt)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                lineHeight: 1.4,
                cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
