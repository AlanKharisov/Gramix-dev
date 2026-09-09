import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME_PATH});
try {
  const page=await browser.newPage({viewport:{width:390,height:700}});
  await page.route('**/memory-test',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
  await page.route('**/src/pages/firebase-config*',route=>route.fulfill({contentType:'text/javascript',body:'export const db={};'}));
  await page.route('**/src/services/firestoreCompat*',route=>route.fulfill({contentType:'text/javascript',body:`export const doc=(db,collection,id)=>({id});export const getDoc=async()=>({exists:()=>true,data:()=>({image:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'})});`}));
  await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:5184')+'/memory-test');
  await page.evaluate(async()=>{
    const {default:refresh}=await import('/@react-refresh');refresh.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {default:Thumbnail}=await import('/src/components/MealThumbnail.jsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('div',null,Array.from({length:100},(_,i)=>React.createElement(Thumbnail,{key:i,mealId:String(i),fallback:'/favicon.svg',style:{display:'block',height:160,width:160}}))));
  });
  await page.waitForFunction(()=>document.querySelector('img')?.src.startsWith('data:'));
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForFunction(()=>document.querySelector('img')?.src.endsWith('/favicon.svg')&&[...document.querySelectorAll('img')].at(-1).src.startsWith('data:'));
  assert.ok(await page.locator('img[src^="data:"]').count()<12);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForFunction(()=>document.querySelector('img')?.src.startsWith('data:'));
  console.log('Thumbnail memory: distant images released and reload on return.');
}finally{await browser.close();}
