// Retry only reads: a failed POST may already have saved a meal or billed AI.
export async function fetchWithReadRetry(url, options = {}, fetcher = globalThis.fetch) {
  try { return await fetcher(url, options); }
  catch (error) {
    if (!['GET','HEAD'].includes((options.method || 'GET').toUpperCase()) || options.signal?.aborted ||
        error?.name === 'AbortError' || error?.name === 'TimeoutError' || !(error instanceof TypeError) ||
        globalThis.navigator?.onLine === false || globalThis.document?.hidden) throw error;
    await new Promise((resolve,reject)=>{
      const abort=()=>{clearTimeout(timer);reject(options.signal.reason || new DOMException('Cancelled','AbortError'));};
      const timer=setTimeout(()=>{options.signal?.removeEventListener('abort',abort);resolve();},300);
      options.signal?.addEventListener('abort',abort,{once:true});
      if(options.signal?.aborted)abort();
    });
    return fetcher(url, options);
  }
}
