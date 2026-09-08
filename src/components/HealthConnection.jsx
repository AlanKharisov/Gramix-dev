import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../services/apiClient';
import { API_BASE } from '../config';
export default function HealthConnection({health}) {
  const {t,i18n}=useTranslation();const [key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const action=async method=>{
    if(method==='DELETE'&&!window.confirm(t('h_revokeConfirm')))return;
    if(method==='POST'&&health.connected&&!window.confirm(t('h_rotateConfirm')))return;
    setBusy(true);setMessage('');
    try {const result=await apiFetch('/health-connection',{method,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})}:{})});setKey(result.token||'');health.refresh();}
    catch{setMessage(t('error'));}finally{setBusy(false);}
  };
  const copy=async value=>{try{await navigator.clipboard.writeText(value);setMessage(t('h_copied'));}catch{setMessage(t('h_copyManual'));}};
  const url=API_BASE+'/health-import';
  return <details className="profile-group gx-health-connect">
    <summary>Apple Health · Health Auto Export</summary>
    <p>{health.lastSync?t('h_sync',{time:new Date(health.lastSync).toLocaleString(i18n.language)}):t('h_wait')}</p>
    {health.error&&<p role="status">{t('error')}</p>}
    <p>{t('h_privacy')}</p>
    <p>{t('h_sportImport')}</p>
    <button className="gx-primary" disabled={busy} onClick={()=>action('POST')}>{t(health.connected?'h_rotate':'h_connect')}</button>
    {(key||health.connected)&&<>
      <label>URL<input readOnly value={url} onFocus={e=>e.target.select()} /></label>
      <button onClick={()=>copy(url)}>{t('h_copyUrl')}</button>
      {key&&<><label>X-API-Key<input type="password" readOnly value={key} autoComplete="off" /></label><button onClick={()=>copy(key)}>{t('h_copyKey')}</button><p>{t('h_keyOnce')}</p></>}
      <ol><li>Automations → New Automation → REST API</li><li>{t('h_headers')}</li><li>Health Metrics: Step Count, Active Energy, Basal Energy Burned</li><li>JSON · Version 2 · Summarize Data: ON · Time Grouping: Days</li><li>Date Range: Default · Batch Requests: OFF</li><li>{t('h_run')}</li></ol>
      <p>{t('h_historyImport')}</p>
      <button disabled={busy} onClick={health.refresh}>{t('h_check')}</button>
      <button disabled={busy} onClick={()=>action('DELETE')}>{t('h_revoke')}</button>
    </>}
    {message&&<p role="status">{message}</p>}
  </details>;
}
