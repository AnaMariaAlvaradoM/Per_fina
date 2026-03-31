import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const SUGGESTIONS = [
  '¿En qué estoy gastando más?',
  '¿Cómo voy este mes?',
  'Resumen de mis deudas',
  '¿Cuánto puedo ahorrar?',
];

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente financiera 💸 Tengo acceso a tus cuentas, gastos y deudas. ¿En qué te ayudo?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const { household } = useAuth();

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const history = messages.filter(m => m.role !== 'system');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const { reply } = await api.chat({
        message: msg,
        household_id: household?.id,
        conversation_history: history.map(m => ({ role: m.role, content: m.content }))
      });
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error conectando. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <div className="ai-panel-title">
              <div className="ai-dot" />
              Asistente FinanzApp
            </div>
            <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="ai-messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg-bot" style={{ opacity: 0.6 }}>
                <span style={{ animation: 'pulse 1s infinite' }}>Pensando...</span>
              </div>
            )}
            {messages.length === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '7px 10px', color: 'var(--text2)', fontSize: '0.8rem', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'var(--font)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="ai-input-row">
            <input
              className="ai-input"
              placeholder="Pregúntame algo..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
            />
            <button className="ai-send" onClick={() => send()} disabled={loading}>➤</button>
          </div>
        </div>
      )}

      <button className="ai-fab" onClick={() => setOpen(o => !o)} title="Asistente IA">
        {open ? '✕' : '✨'}
      </button>
    </>
  );
}
