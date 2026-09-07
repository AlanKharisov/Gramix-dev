import { useCallback, useEffect, useState } from 'react';
import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';
import { apiFetch } from '../services/apiClient';
export function useHealthImport() {
  const uid=auth.currentUser?.uid;
  const [state,setState]=useState({connected:false,lastSync:null,days:[],error:false});
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(n=>n+1),[]);
  useEffect(()=>{
    if(!isPersonalBudget(auth.currentUser))return;
    let active=true,pending=false,last=0;
    const read=async()=>{
      if(document.hidden||pending||Date.now()-last<10000)return;
      pending=true;last=Date.now();
      try { const result=await apiFetch('/health-connection');if(active&&auth.currentUser?.uid===uid)setState({...result,owner:uid,days:Array.isArray(result.days)?result.days:[],error:false}); }
      catch {if(active)setState(old=>old.owner===uid?{...old,error:true}:{owner:uid,connected:false,lastSync:null,days:[],error:true});}finally{pending=false;}
    };
    void read();const timer=setInterval(read,300000);
    window.addEventListener('focus',read);document.addEventListener('visibilitychange',read);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',read);document.removeEventListener('visibilitychange',read);};
  },[uid,revision]);
  return {...(state.owner===uid?state:{connected:false,lastSync:null,days:[],error:false}),refresh};
}
