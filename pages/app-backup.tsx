// ═══════════════════════════════════════════════════════════════════════════════
// FILE: pages/app.tsx - Main App Page (v7 — sidebar layout + profile)
// Replace your existing pages/app.tsx with this entire file
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
  audioUrl?: string;
  imageUrl?: string;
  conversationId?: string;
  rating?: 'up' | 'down';
};

const SIDEBAR_ITEMS = [
  { key: 'beginner', icon: '🧭', title: 'New to Farming', live: true },
  { key: 'crops', icon: '🌱', title: 'Crop Advice', live: true },
  { key: 'animals', icon: '🐔', title: 'Animal Health', live: true },
  { key: 'business', icon: '💰', title: 'Farm Business', live: true },
];

const SIDEBAR_SOON = [
  { icon: '📈', title: 'Market Prices' },
  { icon: '⛅', title: 'Weather' },
  { icon: '💬', title: 'Community' },
];

const EXAMPLES = [
  'My chicken is not eating',
  'When should I harvest my maize?',
  'How do I price my tomatoes?',
];

const BEGINNER_STARTER = "I want to start farming but I don't know where to begin. Can you help me?";

type FarmRecord = {
  id: string;
  record_type: 'crop' | 'animal' | 'expense' | 'sale';
  name: string;
  quantity: number | null;
  unit: string | null;
  amount: number | null;
  record_date: string;
  notes: string | null;
};

const RECORD_TYPE_ICON: Record<string, string> = { crop: '🌱', animal: '🐔', expense: '💵', sale: '💰' };

export default function App() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string }>({});
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('tw');
  const [category, setCategory] = useState('animals');
  const [recordingTime, setRecordingTime] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // ─── Profile modal state ───
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── View switching: chat dashboard vs. farm records ───
  const [activeView, setActiveView] = useState<'chat' | 'records'>('chat');
  const [records, setRecords] = useState<FarmRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [newRecordType, setNewRecordType] = useState<'crop' | 'animal' | 'expense' | 'sale'>('crop');
  const [newRecordName, setNewRecordName] = useState('');
  const [newRecordQuantity, setNewRecordQuantity] = useState('');
  const [newRecordUnit, setNewRecordUnit] = useState('');
  const [newRecordAmount, setNewRecordAmount] = useState('');
  const [newRecordDate, setNewRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [newRecordNotes, setNewRecordNotes] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // ─── Report generation ───
  const [showReportModal, setShowReportModal] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstOfMonthStr = new Date().toISOString().slice(0, 8) + '01';
  const [reportStart, setReportStart] = useState(firstOfMonthStr);
  const [reportEnd, setReportEnd] = useState(todayStr);

  const englishHistoryRef = useRef<{ role: string; content: string }[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/');
        return;
      }
      setUser(data.session.user);

      const { data: profileRow } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', data.session.user.id)
        .single();

      if (profileRow) setProfile(profileRow);
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ─── Photo (crop/animal) selection ───
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
    e.target.value = '';
  };

  const clearPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('farm-photos').upload(path, file);
      if (error) return null;
      const { data } = supabase.storage.from('farm-photos').getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  // ─── Profile: avatar selection ───
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    setProfileAvatarFile(file);
    setProfileAvatarPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const openProfileModal = () => {
    setProfileName(profile.full_name || '');
    setProfileAvatarPreview(profile.avatar_url || null);
    setProfileAvatarFile(null);
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      let avatarUrl = profile.avatar_url;

      if (profileAvatarFile) {
        const ext = profileAvatarFile.name.split('.').pop() || 'jpg';
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, profileAvatarFile, { upsert: true });
        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = data.publicUrl;
        }
      }

      await supabase
        .from('users')
        .update({ full_name: profileName, avatar_url: avatarUrl })
        .eq('id', user.id);

      setProfile({ full_name: profileName, avatar_url: avatarUrl });
      setShowProfileModal(false);
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── Shared submit logic ───
  const submitToAI = async (payload: {
    audioBuffer?: string;
    textInput?: string;
    displayText?: string;
    imageBase64?: string;
    imageMimeType?: string;
    imageUrl?: string;
  }) => {
    setLoading(true);

    if (payload.displayText || payload.imageUrl) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: payload.displayText || '(Photo attached)', imageUrl: payload.imageUrl },
      ]);
    }

    try {
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: {
          audioBuffer: payload.audioBuffer,
          textInput: payload.textInput,
          imageBase64: payload.imageBase64,
          imageMimeType: payload.imageMimeType,
          imageUrl: payload.imageUrl,
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
        { role: 'ai', text: data.response, audioUrl: data.audioBase64 || undefined, conversationId: data.conversationId },
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
    if (!value && !pendingImage) return;
    if (loading) return;

    if (pendingImage) {
      setUploadingImage(true);
      const [base64, publicUrl] = await Promise.all([
        fileToBase64(pendingImage.file),
        uploadImageToStorage(pendingImage.file),
      ]);
      setUploadingImage(false);

      const displayText = value || 'What do you see in this photo?';
      setTextInput('');
      clearPendingImage();

      await submitToAI({
        textInput: displayText,
        displayText,
        imageBase64: base64,
        imageMimeType: pendingImage.file.type,
        imageUrl: publicUrl || undefined,
      });
    } else {
      setTextInput('');
      await submitToAI({ textInput: value, displayText: value });
    }
  };

  // ─── Farm Records: fetch, add, delete ───
  const fetchRecords = async () => {
    const { data } = await supabase
      .from('farm_records')
      .select('*')
      .eq('user_id', user.id)
      .order('record_date', { ascending: false });
    if (data) setRecords(data as FarmRecord[]);
    setRecordsLoaded(true);
  };

  const openRecordsView = () => {
    setActiveView('records');
    if (!recordsLoaded) fetchRecords();
  };

  const addRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordName.trim()) return;
    setSavingRecord(true);
    try {
      const { error } = await supabase.from('farm_records').insert({
        user_id: user.id,
        record_type: newRecordType,
        name: newRecordName.trim(),
        quantity: newRecordQuantity ? Number(newRecordQuantity) : null,
        unit: newRecordUnit.trim() || null,
        amount: newRecordAmount ? Number(newRecordAmount) : null,
        record_date: newRecordDate,
        notes: newRecordNotes.trim() || null,
      });
      if (!error) {
        setNewRecordName('');
        setNewRecordQuantity('');
        setNewRecordUnit('');
        setNewRecordAmount('');
        setNewRecordNotes('');
        await fetchRecords();
      }
    } finally {
      setSavingRecord(false);
    }
  };

  const deleteRecord = async (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    await supabase.from('farm_records').delete().eq('id', id);
  };

  // Live summary — computed from real entries, not placeholders
  const cropCount = records.filter((r) => r.record_type === 'crop').length;
  const animalCount = records
    .filter((r) => r.record_type === 'animal')
    .reduce((sum, r) => sum + (r.quantity || 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = records
    .filter((r) => r.record_type === 'expense' && r.record_date?.startsWith(thisMonth))
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  // ─── Report data — computed live from actual records, within the picked range ───
  const inRange = (d: string) => d >= reportStart && d <= reportEnd;
  const reportActivity = records.filter((r) => (r.record_type === 'crop' || r.record_type === 'animal') && inRange(r.record_date));
  const reportExpenses = records.filter((r) => r.record_type === 'expense' && inRange(r.record_date));
  const reportSales = records.filter((r) => r.record_type === 'sale' && inRange(r.record_date));
  const reportExpenseTotal = reportExpenses.reduce((s, r) => s + (r.amount || 0), 0);
  const reportSalesTotal = reportSales.reduce((s, r) => s + (r.amount || 0), 0);
  const reportNet = reportSalesTotal - reportExpenseTotal;

  // Simple estimate — a plain average projected forward, clearly labeled as
  // a rough estimate, not a prediction model.
  const rangeDays = Math.max(
    1,
    Math.round((new Date(reportEnd).getTime() - new Date(reportStart).getTime()) / 86400000) + 1
  );
  const dailyAvgExpense = reportExpenseTotal / rangeDays;
  const dailyAvgSale = reportSalesTotal / rangeDays;
  const next30DaysExpenseEstimate = Math.round(dailyAvgExpense * 30);
  const next30DaysSaleEstimate = Math.round(dailyAvgSale * 30);

  const handleSidebarClick = (key: string) => {
    setActiveView('chat');
    setCategory(key);
    if (key === 'beginner' && !textInput.trim()) {
      setTextInput(BEGINNER_STARTER);
    }
  };

  const rateMessage = async (index: number, rating: 'up' | 'down') => {
    const msg = messages[index];
    if (!msg.conversationId) return;
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, rating } : m)));
    await supabase.from('conversations').update({ user_rating: rating === 'up' ? 5 : 1 }).eq('id', msg.conversationId);
  };

  const initials = (profile.full_name || user?.email || '?').slice(0, 2).toUpperCase();
  const firstName = profile.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Farmer';

  if (!user) {
    return <div className="page"><p style={{ marginTop: '60px', opacity: 0.6, textAlign: 'center' }}>Loading…</p></div>;
  }

  return (
    <div>
      <div className="dashboard-top-stripe" />

      <nav className="navbar">
        <div className="nav-brand"><span className="mark">🌾</span><span className="name">FarmAssist</span></div>
        <div style={{ flex: 1 }} />
        <div className="nav-user">
          <div className="nav-avatar" onClick={openProfileModal} title="Edit profile">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="Your profile photo" /> : initials}
          </div>
          <div className="nav-user-info"><span className="name">{firstName}</span><span className="plan">Free Plan</span></div>
          <button className="nav-signout" onClick={() => supabase.auth.signOut().then(() => router.push('/'))}>Sign out</button>
        </div>
      </nav>

      <div className="app-layout">
        {/* ─── Sidebar ─── */}
        <aside className="app-sidebar">
          <div
            className={`sidebar-item ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveView('chat')}
          >
            <span className="si-icon">🏠</span><span>Dashboard</span>
          </div>

          <div
            className={`sidebar-item ${activeView === 'records' ? 'active' : ''}`}
            onClick={openRecordsView}
          >
            <span className="si-icon">📋</span><span>Farm Records</span>
          </div>

          <div className="sidebar-divider" />

          {SIDEBAR_ITEMS.map((item) => (
            <div
              key={item.key}
              className={`sidebar-item ${activeView === 'chat' && category === item.key ? 'active' : ''}`}
              onClick={() => handleSidebarClick(item.key)}
            >
              <span className="si-icon">{item.icon}</span><span>{item.title}</span>
            </div>
          ))}

          <div className="sidebar-divider" />

          {SIDEBAR_SOON.map((item) => (
            <div key={item.title} className="sidebar-item soon" onClick={() => alert('This feature is coming soon!')}>
              <span className="si-icon">{item.icon}</span><span>{item.title}</span><span className="si-soon">Soon</span>
            </div>
          ))}

          <div className="sidebar-bottom">
            <div className="sidebar-divider" />
            <div className="sidebar-item" onClick={openProfileModal}>
              <span className="si-icon">👤</span><span>Profile</span>
            </div>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <div className="app-main">
          {activeView === 'records' ? (
            <div className="content-body" style={{ paddingTop: 32 }}>
              <div className="records-header">
                <h1 className="hero-greeting" style={{ color: 'var(--forest)' }}>Farm Records</h1>
              </div>

              <div className="report-trigger-row">
                <button className="btn-report" onClick={() => setShowReportModal(true)}>
                  🖨️ Print report
                </button>
              </div>

              <div className="records-summary">
                <div className="summary-card">
                  <span className="summary-icon">🌱</span>
                  <span className="summary-num">{cropCount}</span>
                  <span className="summary-label">Crop plots logged</span>
                </div>
                <div className="summary-card">
                  <span className="summary-icon">🐔</span>
                  <span className="summary-num">{animalCount}</span>
                  <span className="summary-label">Animals tracked</span>
                </div>
                <div className="summary-card">
                  <span className="summary-icon">💵</span>
                  <span className="summary-num">₵{monthExpenses.toFixed(0)}</span>
                  <span className="summary-label">Spent this month</span>
                </div>
              </div>

              <form className="record-form" onSubmit={addRecord}>
                <div className="record-type-tabs">
                  {(['crop', 'animal', 'expense', 'sale'] as const).map((t) => (
                    <div
                      key={t}
                      className={`record-type-tab ${newRecordType === t ? 'selected' : ''}`}
                      onClick={() => setNewRecordType(t)}
                    >
                      {RECORD_TYPE_ICON[t]} {t === 'crop' ? 'Crop' : t === 'animal' ? 'Animal' : t === 'expense' ? 'Expense' : 'Sale'}
                    </div>
                  ))}
                </div>

                <div className="record-form-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Name</label>
                    <input
                      type="text"
                      value={newRecordName}
                      onChange={(e) => setNewRecordName(e.target.value)}
                      placeholder={newRecordType === 'crop' ? 'e.g. Maize Plot 1' : newRecordType === 'animal' ? 'e.g. Layer flock A' : 'e.g. Bought feed'}
                      required
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Date</label>
                    <input type="date" value={newRecordDate} onChange={(e) => setNewRecordDate(e.target.value)} />
                  </div>
                </div>

                {newRecordType !== 'expense' && newRecordType !== 'sale' ? (
                  <div className="record-form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Quantity</label>
                      <input
                        type="number"
                        value={newRecordQuantity}
                        onChange={(e) => setNewRecordQuantity(e.target.value)}
                        placeholder={newRecordType === 'crop' ? 'e.g. 2' : 'e.g. 15'}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Unit</label>
                      <input
                        type="text"
                        value={newRecordUnit}
                        onChange={(e) => setNewRecordUnit(e.target.value)}
                        placeholder={newRecordType === 'crop' ? 'e.g. acres' : 'e.g. birds'}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="record-form-grid full">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Amount (₵)</label>
                      <input
                        type="number"
                        value={newRecordAmount}
                        onChange={(e) => setNewRecordAmount(e.target.value)}
                        placeholder={newRecordType === 'sale' ? 'e.g. 400' : 'e.g. 150'}
                      />
                    </div>
                  </div>
                )}

                <div className="field-row" style={{ marginBottom: 14, marginTop: 14 }}>
                  <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label>Notes (optional)</label>
                    <input
                      type="text"
                      value={newRecordNotes}
                      onChange={(e) => setNewRecordNotes(e.target.value)}
                      placeholder="Any details worth remembering…"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={savingRecord || !newRecordName.trim()}>
                  {savingRecord ? 'Saving…' : '+ Add record'}
                </button>
              </form>

              <div className="records-list">
                {recordsLoaded && records.length === 0 && (
                  <div className="records-empty">No records yet — add your first crop, animal, or expense above.</div>
                )}
                {records.map((r) => (
                  <div key={r.id} className="record-row">
                    <div className="record-type-icon">{RECORD_TYPE_ICON[r.record_type]}</div>
                    <div className="record-info">
                      <div className="record-name">{r.name}</div>
                      <div className="record-meta">
                        {r.record_date}
                        {r.quantity ? ` · ${r.quantity} ${r.unit || ''}` : ''}
                        {r.notes ? ` · ${r.notes}` : ''}
                      </div>
                    </div>
                    {r.amount != null && <div className="record-amount">₵{r.amount}</div>}
                    <button className="record-delete-btn" onClick={() => deleteRecord(r.id)} aria-label="Delete record">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <>
          <div className="hero-banner">
            <div className="hero-inner">
              <h1 className="hero-greeting">Maakye, {firstName}! 👋</h1>
              <p className="hero-sub">Ask FarmAssist anything about your farm — or attach a photo.</p>

              <div className="hero-controls">
                <div className="field">
                  <label htmlFor="language">Language</label>
                  <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="tw">Twi</option><option value="en">English</option>
                    <option value="fante">Fante</option><option value="ewe">Ewe</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="beginner">New to farming</option>
                    <option value="animals">Animals</option><option value="crops">Crops</option><option value="business">Farm business</option>
                  </select>
                </div>
              </div>

              {pendingImage && (
                <div className="image-preview-strip">
                  <img src={pendingImage.preview} alt="Selected crop or animal photo" />
                  <button type="button" onClick={clearPendingImage} className="remove-image-btn" aria-label="Remove photo">✕</button>
                </div>
              )}

              <form onSubmit={handleTextSubmit} className="hero-input-pill">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={pendingImage ? 'Describe what you want to know (optional)…' : 'Bisa wo mfoni ho asɛm… / Ask your question…'}
                  disabled={loading || uploadingImage}
                />

                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploadingImage} className="hero-photo-btn" aria-label="Attach a photo">📷</button>

                {(textInput.trim() || pendingImage) && (
                  <button type="submit" className="hero-send-btn" disabled={loading || uploadingImage}>
                    {uploadingImage ? 'Uploading…' : 'Send'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={loading || uploadingImage}
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
                {EXAMPLES.map((ex) => <span key={ex} className="chip" onClick={() => setTextInput(ex)}>{ex}</span>)}
                <span className="chip">📷 Or attach a photo of your crop/animal</span>
              </div>
            </div>
          </div>

          <div className="content-body">
            {/* Conversation panel — right below the hero, as requested */}
            <div className="ai-panel">
              <div className="ai-panel-header"><h3>Ask FarmAssist</h3><span className="ai-panel-badge">AI Response</span></div>

              <div className="ai-panel-body">
                {messages.length === 0 && !loading && (
                  <div className="ai-panel-empty">
                    <span className="empty-icon">🌾</span>
                    <span className="empty-text">Your conversation will appear here — ask a question or attach a photo to get started.</span>
                  </div>
                )}
                <div className="thread">
                  {messages.map((m, i) => (
                    <div key={i} className={`bubble-row ${m.role}`}>
                      <div className={`bubble ${m.role}`}>
                        {m.imageUrl && <img src={m.imageUrl} alt="Uploaded farm photo" className="bubble-image" />}
                        {m.text}
                        {m.audioUrl && <button onClick={() => new Audio(m.audioUrl).play()} className="bubble-play" aria-label="Play audio">🔊</button>}
                        {m.role === 'ai' && m.conversationId && (
                          <div className="bubble-feedback">
                            <span>Was this helpful?</span>
                            <button className={`thumb-btn ${m.rating === 'up' ? 'selected' : ''}`} onClick={() => rateMessage(i, 'up')}>👍</button>
                            <button className={`thumb-btn ${m.rating === 'down' ? 'selected' : ''}`} onClick={() => rateMessage(i, 'down')}>👎</button>
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
                <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Type a follow-up…" disabled={loading || uploadingImage} />
                <button type="submit" disabled={loading || uploadingImage || (!textInput.trim() && !pendingImage)}>Send</button>
              </form>
            </div>

            {/* Pricing — right after the conversation, as requested */}
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
          </>
          )}
        </div>
      </div>

      {/* ─── Report Modal ─── */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3>Farm Report</h3>
              <button className="modal-close no-print" onClick={() => setShowReportModal(false)} aria-label="Close" style={{ position: 'static' }}>✕</button>
            </div>

            <div className="report-range-picker no-print">
              <div className="field">
                <label>From</label>
                <input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} />
              </div>
              <div className="field">
                <label>To</label>
                <input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} />
              </div>
            </div>

            <div className="report-body">
              <div className="report-print-header">
                <h2>🌾 FarmAssist — Farm Report</h2>
                <p>{firstName}'s farm · {reportStart} to {reportEnd} · Generated {new Date().toLocaleDateString()}</p>
              </div>

              <div className="report-section">
                <h4>Activity</h4>
                {reportActivity.length === 0 && <div className="report-empty-line">No crop or animal records in this period.</div>}
                {reportActivity.map((r) => (
                  <div key={r.id} className="report-line">
                    <span className="rl-name">{RECORD_TYPE_ICON[r.record_type]} {r.name}</span>
                    <span className="rl-meta">{r.record_date}{r.quantity ? ` · ${r.quantity} ${r.unit || ''}` : ''}</span>
                  </div>
                ))}
              </div>

              <div className="report-section">
                <h4>Expenses</h4>
                {reportExpenses.length === 0 && <div className="report-empty-line">No expenses logged in this period.</div>}
                {reportExpenses.map((r) => (
                  <div key={r.id} className="report-line">
                    <span className="rl-name">{r.name}</span>
                    <span className="rl-meta">{r.record_date}</span>
                    <span className="rl-amount">₵{r.amount}</span>
                  </div>
                ))}
                <div className="report-totals-row"><span>Total expenses</span><span>₵{reportExpenseTotal.toFixed(2)}</span></div>
              </div>

              <div className="report-section">
                <h4>Sales</h4>
                {reportSales.length === 0 && <div className="report-empty-line">No sales logged in this period.</div>}
                {reportSales.map((r) => (
                  <div key={r.id} className="report-line">
                    <span className="rl-name">{r.name}</span>
                    <span className="rl-meta">{r.record_date}</span>
                    <span className="rl-amount">₵{r.amount}</span>
                  </div>
                ))}
                <div className="report-totals-row"><span>Total sales</span><span>₵{reportSalesTotal.toFixed(2)}</span></div>
              </div>

              <div className="report-section">
                <h4>Net (Sales − Expenses)</h4>
                <div className="report-net-box">
                  <span className="net-label">For this period</span>
                  <span className={`net-amount ${reportNet >= 0 ? 'positive' : 'negative'}`}>
                    {reportNet >= 0 ? '+' : ''}₵{reportNet.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="report-section">
                <h4>Simple 30-Day Estimate</h4>
                <div className="report-line">
                  <span className="rl-name">Estimated expenses (next 30 days)</span>
                  <span className="rl-amount">₵{next30DaysExpenseEstimate}</span>
                </div>
                <div className="report-line">
                  <span className="rl-name">Estimated sales (next 30 days)</span>
                  <span className="rl-amount">₵{next30DaysSaleEstimate}</span>
                </div>
                <p className="report-forecast-note">
                  This is a simple estimate based on your average recorded amounts over the selected period — it is not a prediction and doesn't account for seasons, weather, or market changes. Use it as a rough guide only.
                </p>
              </div>
            </div>

            <div className="report-modal-footer no-print">
              <button className="btn btn-outline" onClick={() => setShowReportModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Profile Modal ─── */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowProfileModal(false)} aria-label="Close">✕</button>
            <h3>Edit your profile</h3>

            <div className="avatar-upload-row">
              <div className="avatar-preview">
                {profileAvatarPreview ? <img src={profileAvatarPreview} alt="Your profile photo" /> : initials}
              </div>
              <input type="file" accept="image/*" ref={avatarFileInputRef} onChange={handleAvatarSelect} style={{ display: 'none' }} />
              <button type="button" className="avatar-upload-btn" onClick={() => avatarFileInputRef.current?.click()}>
                Change photo
              </button>
            </div>

            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowProfileModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}