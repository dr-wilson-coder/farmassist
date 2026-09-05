// ═══════════════════════════════════════════════════════════════════════════════
// FILE: pages/app.tsx - Main App Page (v4 — dashboard layout)
// Replace your existing pages/app.tsx with this entire file
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
  audioUrl?: string;
  conversationId?: string;
  rating?: 'up' | 'down';
};

const QUICK_ACTIONS = [
  { key: 'crops', icon: '🌱', title: 'Crop Advice', desc: 'Get advice for your crops', live: true },
  { key: 'animals', icon: '🐔', title: 'Animal Health', desc: 'Health tips & care for animals', live: true },
  { key: 'business', icon: '💰', title: 'Farm Business', desc: 'Costs, pricing & planning', live: true },
  { key: 'weather', icon: '⛅', title: 'Weather', desc: 'Local forecasts & alerts', live: false },
  { key: 'market', icon: '📈', title: 'Market Prices', desc: 'Check live market prices', live: false },
  { key: 'records', icon: '🗂️', title: 'Farm Records', desc: 'Tasks & reminders', live: false },
];

const EXAMPLES = [
  'My chicken is not eating',
  'When should I harvest my maize?',
  'How do I price my tomatoes?',
];

export default function App() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('tw');
  const [category, setCategory] = useState('animals');
  const [recordingTime, setRecordingTime] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const englishHistoryRef = useRef<{ role: string; content: string }[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push('/');
      else setUser(data.session.user);
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const submitToAI = async (payload: { audioBuffer?: string; textInput?: string; displayText?: string }) => {
    setLoading(true);
    if (payload.displayText) {
      setMessages((prev) => [...prev, { role: 'user', text: payload.displayText! }]);
    }

    try {
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: {
          audioBuffer: payload.audioBuffer,
          textInput: payload.textInput,
          userId: user.id,
          language,
          category,
          region: 'Ghana',
          conversationHistory: englishHistoryRef.current,
        },
      });

      if (error) {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Something went wrong. Please try again.' }]);
        return;
      }

      if (payload.audioBuffer && data?.originalQuestion) {
        setMessages((prev) => [...prev, { role: 'user', text: data.originalQuestion }]);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: data.response,
          audioUrl: data.audioBase64 || undefined,
          conversationId: data.conversationId,
        },
      ]);

      englishHistoryRef.current = [
        ...englishHistoryRef.current,
        { role: 'user', content: data.englishQuestion },
        { role: 'assistant', content: data.englishResponse },
      ];
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Error: ' + (err.message || 'Unknown error') }]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        await submitToAI({ audioBuffer: base64Audio });
      };
      reader.readAsDataURL(audioBlob);
    };
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = textInput.trim();
    if (!value || loading) return;
    setTextInput('');
    await submitToAI({ textInput: value, displayText: value });
  };

  const handleQuickAction = (key: string, live: boolean) => {
    if (!live) {
      alert('This feature is coming soon!');
      return;
    }
    setCategory(key);
  };

  const rateMessage = async (index: number, rating: 'up' | 'down') => {
    const msg = messages[index];
    if (!msg.conversationId) return;
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, rating } : m)));
    await supabase
      .from('conversations')
      .update({ user_rating: rating === 'up' ? 5 : 1 })
      .eq('id', msg.conversationId);
  };

  const initials = (user?.email || '?').slice(0, 2).toUpperCase();
  const firstName = user?.email?.split('@')[0] || 'Farmer';

  if (!user) {
    return <div className="page"><p style={{ marginTop: '60px', opacity: 0.6, textAlign: 'center' }}>Loading…</p></div>;
  }

  return (
    <div>
      {/* ─── Navigation ─── */}
      <nav className="navbar">
        <div className="nav-brand">
          <span className="mark">🌾</span>
          <span className="name">FarmAssist</span>
        </div>
        <div className="nav-links">
          <span className="nav-link active">🏠 Dashboard</span>
          <span className="nav-link soon">📋 Farm Records <span className="soon-tag">Soon</span></span>
          <span className="nav-link soon">📈 Market Prices <span className="soon-tag">Soon</span></span>
          <span className="nav-link soon">⛅ Weather <span className="soon-tag">Soon</span></span>
          <span className="nav-link soon">💬 Community <span className="soon-tag">Soon</span></span>
        </div>
        <div className="nav-user">
          <div className="nav-avatar">{initials}</div>
          <div className="nav-user-info">
            <span className="name">{firstName}</span>
            <span className="plan">Free Plan</span>
          </div>
          <button className="nav-signout" onClick={() => supabase.auth.signOut().then(() => router.push('/'))}>
            Sign out
          </button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <div className="hero-banner">
        <div className="hero-inner">
          <h1 className="hero-greeting">Maakye, {firstName}! 👋</h1>
          <p className="hero-sub">Ask FarmAssist anything about your farm.</p>

          <div className="hero-controls">
            <div className="field">
              <label htmlFor="language">Language</label>
              <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="tw">Twi</option>
                <option value="en">English</option>
                <option value="fante">Fante</option>
                <option value="ewe">Ewe</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="animals">Animals</option>
                <option value="crops">Crops</option>
                <option value="business">Farm business</option>
              </select>
            </div>
          </div>

          <form onSubmit={handleTextSubmit} className="hero-input-pill">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Bisa wo mfoni ho asɛm… / Ask your question…"
              disabled={loading}
            />
            {textInput.trim() && (
              <button type="submit" className="hero-send-btn" disabled={loading}>Send</button>
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading}
              className={`hero-mic-btn ${isRecording ? 'recording' : ''}`}
              aria-label="Record"
            >
              {isRecording ? '■' : '🎙️'}
            </button>
          </form>

          {isRecording && (
            <div className="hero-waveform" aria-hidden="true">
              <div className="bar" /><div className="bar" /><div className="bar" /><div className="bar" /><div className="bar" />
            </div>
          )}

          <div className="hero-examples">
            <b>Examples:</b>
            {EXAMPLES.map((ex) => (
              <span key={ex} className="chip" onClick={() => setTextInput(ex)}>{ex}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Body: quick actions + AI panel ─── */}
      <div className="dashboard-body">
        <div className="main-col">
          <h2 className="section-title">Quick Actions</h2>
          <div className="quick-actions">
            {QUICK_ACTIONS.map((qa) => (
              <div
                key={qa.key}
                className={`qa-card ${category === qa.key ? 'active' : ''}`}
                onClick={() => handleQuickAction(qa.key, qa.live)}
              >
                {!qa.live && <span className="qa-soon-badge">Soon</span>}
                <div className="qa-icon">{qa.icon}</div>
                <h4>{qa.title}</h4>
                <p>{qa.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="section-title">Plans</h2>
          <div className="pricing-grid">
            {[
              { name: 'Free', price: '₵0/mo', conversations: '20 / month', featured: false },
              { name: 'Pro', price: '₵29/mo', conversations: '500 / month', featured: true },
              { name: 'Enterprise', price: 'Custom', conversations: 'Unlimited', featured: false },
            ].map((plan) => (
              <div key={plan.name} className={`price-card ${plan.featured ? 'featured' : ''}`}>
                <h3>{plan.name}</h3>
                <p className="price-amount">{plan.price}</p>
                <p className="price-conversations">{plan.conversations}</p>
                <button className="btn btn-outline">{plan.name === 'Free' ? 'Current plan' : 'Upgrade'}</button>
              </div>
            ))}
          </div>
        </div>

        {/* ─── AI Response panel ─── */}
        <div className="ai-panel">
          <div className="ai-panel-header">
            <h3>Ask FarmAssist</h3>
            <span className="ai-panel-badge">AI Response</span>
          </div>

          <div className="ai-panel-body">
            {messages.length === 0 && !loading && (
              <div className="ai-panel-empty">Your conversation will appear here.</div>
            )}
            <div className="thread">
              {messages.map((m, i) => (
                <div key={i} className={`bubble-row ${m.role}`}>
                  <div className={`bubble ${m.role}`}>
                    {m.text}
                    {m.audioUrl && (
                      <button onClick={() => new Audio(m.audioUrl).play()} className="bubble-play" aria-label="Play audio">🔊</button>
                    )}
                    {m.role === 'ai' && m.conversationId && (
                      <div className="bubble-feedback">
                        <span>Was this helpful?</span>
                        <button
                          className={`thumb-btn ${m.rating === 'up' ? 'selected' : ''}`}
                          onClick={() => rateMessage(i, 'up')}
                        >👍</button>
                        <button
                          className={`thumb-btn ${m.rating === 'down' ? 'selected' : ''}`}
                          onClick={() => rateMessage(i, 'down')}
                        >👎</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="bubble-row ai">
                  <div className="bubble ai bubble-loading"><span className="dot" /><span className="dot" /><span className="dot" /></div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>
          </div>

          <form onSubmit={handleTextSubmit} className="ai-panel-input">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a follow-up…"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !textInput.trim()}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}