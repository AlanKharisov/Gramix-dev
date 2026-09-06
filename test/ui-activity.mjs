import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5181';
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/src/pages/firebase-config*', route => route.fulfill({ contentType: 'text/javascript', body: `
    const user = { uid:'activity-test', email:${JSON.stringify(process.env.TEST_PERSONAL_EMAIL || 'test@example.invalid')}, emailVerified:true, providerData:[{providerId:'google.com'}], getIdToken:async()=>'test' };
    export const auth = { currentUser:user, authStateReady:async()=>{}, onAuthStateChanged(fn) { let active=true;queueMicrotask(()=>{if(active)fn(user)});return()=>{active=false}; } };
    export const db = {};
  ` }));
  await page.route('**/src/services/steps*', route => route.fulfill({ contentType: 'text/javascript', body: `
    const date = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    let history=[{date:date(yesterday),steps:8000,baseGoal:1979,extra:127,activeKcal:203,source:'health_connect',partial:false,updatedAt:1}];
    export const stepsAvailable=true;
    export const readSteps=async(uid,method)=>({status:method==='disconnect'?'disabled':'ready',enabled:method!=='disconnect',healthAvailable:true,date:date(new Date()),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,steps:window.__steps||10000,source:'health_connect',partial:false});
    export const watchSteps=async()=>({remove(){}});
    export const pauseSteps=async()=>{};
    export const loadStepHistory=async()=>({days:history});
    export const saveStepDay=async(uid,day)=>{history=[...history.filter(d=>d.date!==day.date),{...day,updatedAt:Date.now()}];return{days:history};};
  ` }));
  const profile={profileCompleted:true,emailVerified:true,language:process.env.TEST_LANG || 'ru',weight:70,height:175,age:30,gender:'male',goal:'maintain',activityLevel:'sedentary',dailyNorm:{calories:1979,proteins:124,fats:55,carbs:247}};
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const meals=[{id:'today',data:{date:new Date().toISOString(),name:'Today',calories:1500,ingredients:[]}},
    {id:'yesterday',data:{date:yesterday.toISOString(),name:'Yesterday',calories:2500,ingredients:[]}}];
  await page.route('**/api/**', route=>{
    const url=new URL(route.request().url()), target=url.searchParams.get('path')||'';
    const data=url.pathname.endsWith('/account')?{publicId:'0000001'}:
      url.pathname.endsWith('/collection')?{documents:target.endsWith('/meals')?meals:[]}:
      {exists:true,data:target.includes('normHistory')?{effectiveFrom:'1970-01-01',...profile.dailyNorm}:profile};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(base+'/main');
  if (process.env.TEST_PERSONAL_EMAIL) {
    await page.waitForFunction(()=>document.querySelector('.gx-calorie-eaten')?.textContent==='657');
    assert.equal(await page.locator('.home-rings-card .gx-budget-status').count(),0);
    if (process.env.TEST_LANG === 'uk') assert.equal(await page.locator('.gx-calorie-label').innerText(),'Залишилось');
    assert.match((await page.locator('.gx-budget-status strong').innerText()).replace(/\D/g,''),/2000/);
    await page.evaluate(()=>{window.__steps=12000;window.dispatchEvent(new Event('focus'));});
    await page.waitForFunction(()=>document.querySelector('.gx-calorie-eaten')?.textContent==='707');
    assert.equal(await page.locator('.gx-calorie-balance').count(),0);
    await page.screenshot({path:'/tmp/gramix-personal.png'});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,personal:true,remaining:707,average:2000}));
  } else {
  await page.waitForFunction(()=>document.querySelector('.gx-calorie-balance')?.textContent.includes('657'));
  assert.equal(Number((await page.locator('.gx-calorie-eaten').innerText()).replace(/\D/g,'')),1500);
  await page.locator('.gx-calorie-limit').click();
  assert.equal(Number((await page.locator('.gx-budget-average strong').first().innerText()).replace(/\D/g,'')),2000);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.main-page .gx-steps').count(), 0);
  assert.equal(await page.locator('.main-page .gx-eaten-summary').count(), 0);
  await page.screenshot({path:'/tmp/gramix-1.0.18-main.png'});
  await page.evaluate(()=>{window.__steps=12000;window.dispatchEvent(new Event('focus'));});
  await page.waitForFunction(()=>document.querySelector('.gx-calorie-balance')?.textContent.includes('707'));
  await page.locator('.main-page:visible .home-tabbar button').nth(1).click();
  await page.locator('.stats-page:visible .gx-calorie-overview').waitFor();
  assert.equal(await page.locator('.stats-page .gx-budget-status').count(),0);
  assert.equal(await page.locator('.stats-page .gx-activity-summary, .stats-page .gx-eaten-summary').count(),0);
  for (const index of [0,1,2,3]) {
    await page.locator('.period-selector button').nth(index).click();
    const expected=[707,7*1979+355-4000,30*1979+355-4000,365*1979+355-4000][index];
    await page.waitForFunction(expected=>Number(document.querySelector('.stats-page .gx-calorie-balance')?.textContent.replace(/\D/g,''))===expected,expected);
    const count=[7,7,30,365][index];
    await page.locator('.stats-page:visible .gx-calorie-limit').click();
    assert.match(await page.locator('.gx-budget-average').innerText(),new RegExp(String(count)));
    await page.keyboard.press('Escape');
  }
  await page.locator('.period-selector button').nth(1).click();
  await page.screenshot({path:'/tmp/gramix-1.0.18-stats.png'});
  await page.locator('.stats-page:visible .home-tabbar button').first().click();
  await page.waitForURL('**/main');
  await page.locator('.main-page:visible .main-profile-btn').click();
  await page.waitForURL('**/profile');
  const toggle=page.locator('.profile-scroll [role="switch"]');
  await toggle.waitFor();
  await page.waitForFunction(()=>document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='true');
  await toggle.click();
  await page.waitForFunction(()=>document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='false');
  await toggle.click();
  await page.waitForFunction(()=>document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='true');
  await page.locator('.profile-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight});
  const order=await page.evaluate(()=>{
    const button=document.querySelector('.gx-profile-extras');
    return button.previousElementSibling.textContent;
  });
  assert.match(order,/Поддержка/);
  meals[0].data.calories=3000;
  await page.goto(base+'/main');
  await page.locator('.gx-calorie-overview.is-over').waitFor();
  await page.waitForFunction(()=>document.querySelector('.gx-calorie-balance')?.textContent==='843');
  await page.screenshot({path:'/tmp/gramix-1.0.18-over.png'});
  await page.locator('.gx-budget-status').click();
  await page.locator('.gx-budget-details').waitFor();
  await page.locator('.add-sheet-backdrop').click({position:{x:5,y:5}});
  await page.locator('.add-sheet').waitFor({state:'detached'});
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,average:2000,remainingAfterSteps:707,periods:4,feedbackInSupport:true}));
  }
} finally {await browser.close();}
