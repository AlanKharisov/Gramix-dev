import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddMealSheet from './AddMealSheet';
import { apiFetch } from '../services/apiClient';
import { useBackHandler } from '../hooks/useBackHandler';

export default function ProfileExtras() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackId, setFeedbackId] = useState(() => crypto.randomUUID());
  useBackHandler([{ when: () => open, do: () => { if (!busy) setOpen(false); } }]);
  async function send() {
    setBusy(true); setMessage('');
    try {
      await apiFetch('/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feedbackId, text: feedback.trim(), language: i18n.language }) });
      setFeedback(''); setFeedbackId(crypto.randomUUID()); setMessage(t('x_sent'));
    } catch (error) {
      setMessage(error.status === 429 ? t('x_feedbackLimit') : t('server_error'));
    } finally { setBusy(false); }
  }
  return <>
    <div className="profile-group gx-profile-extras">
      <button className="profile-row profile-row--link" onClick={() => { setMessage(''); setOpen(true); }}>
        <span className="gx-feature-icon" aria-hidden="true">✉</span><span className="profile-row-label">{t('x_feedback')}</span><span aria-hidden="true">›</span>
      </button>
    </div>
    {open && <AddMealSheet title={t('x_feedback')} onClose={() => { if (!busy) setOpen(false); }}>
      <div className="gx-settings">
        <p>{t('x_feedbackHint')}</p>
        <textarea maxLength={2000} disabled={busy} value={feedback} aria-label={t('x_feedback')}
          onChange={e => { setFeedback(e.target.value); setFeedbackId(crypto.randomUUID()); }} />
        <button className="gx-primary" disabled={busy || feedback.trim().length < 5} onClick={send}>{busy ? '…' : t('x_send')}</button>
        {message && <p role="status">{message}</p>}
      </div>
      <button className="add-sheet-cancel" disabled={busy} onClick={() => setOpen(false)}>{t('close')}</button>
    </AddMealSheet>}
  </>;
}
