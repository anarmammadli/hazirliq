let data={groups:[],students:[],payments:[]};
let db=null;
let currentTeacher=null;
let pickerState={dateTarget:null,tempDate:'',monthCursor:null,schedule:{day:'',start:'',end:''},scheduleItems:[],activeTimeField:null};
let isHydrating=true;
let saveTimer=null;
let cloudSyncInProgress=false;
let cloudSyncQueued=false;

const TEACHER_SESSION_KEY='hazirliq_teacher_session_v1';
const $=id=>document.getElementById(id);
const days=['Bazar ertəsi','Çərşənbə axşamı','Çərşənbə','Cümə axşamı','Cümə','Şənbə','Bazar'];
const dayShort={ 'Bazar ertəsi':'B.e', 'Çərşənbə axşamı':'Ç.a', 'Çərşənbə':'Ç', 'Cümə axşamı':'C.a', 'Cümə':'C', 'Şənbə':'Ş', 'Bazar':'B' }; 
const monthNames=['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
function timeList(){
  const list=[];
  for(let h=0; h<=23; h++){
    for(const m of [0,15,30,45]){
      list.push(String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0'));
    }
  }
  return list;
}
const months=['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];

function id(){return crypto.randomUUID?crypto.randomUUID():Date.now()+Math.random().toString(16)}
function nowIso(){return new Date().toISOString()}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function withTimeout(promise,ms,label='Əməliyyat gecikdi'){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(label)),ms))
  ]);
}
const DEFAULT_SUPABASE_CONFIG={
  url:'https://dmbqqqdpithwxgshyyuu.supabase.co',
  anonKey:'sb_publishable__yJM--NxxASz70KcaxSBpw_Yyy2ML92',
  adminPassword:'a0516600094'
};
function supabaseConfig(){
  return Object.assign({}, DEFAULT_SUPABASE_CONFIG, window.HAZIRLIQ_SUPABASE_CONFIG || {});
}
function isSupabaseConfigured(){
  const cfg=supabaseConfig();
  return !!(cfg && cfg.url && cfg.anonKey && !String(cfg.url).includes('PASTE_') && !String(cfg.anonKey).includes('PASTE_'));
}
function adminPassword(){
  return String(supabaseConfig().adminPassword || 'a0516600094');
}
function normalizeData(cloudData){
  return {
    groups:Array.isArray(cloudData?.groups)?cloudData.groups:[],
    students:Array.isArray(cloudData?.students)?cloudData.students:[],
    payments:Array.isArray(cloudData?.payments)?cloudData.payments:[],
    __updatedAt:cloudData?.__updatedAt || cloudData?.updatedAt || '1970-01-01T00:00:00.000Z'
  };
}
function dataUpdatedAt(d=data){return d?.__updatedAt || d?.updatedAt || '1970-01-01T00:00:00.000Z'}
function newerOrEqual(a,b){return new Date(a||0).getTime() >= new Date(b||0).getTime()}
function touchData(){data.__updatedAt=nowIso(); return data.__updatedAt;}
function safeTeacherKey(username=currentTeacher?.username){
  return String(username||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'_') || 'unknown';
}
function localDataKey(username=currentTeacher?.username){return 'hazirliq_teacher_data_v1_' + safeTeacherKey(username)}
function localPendingKey(username=currentTeacher?.username){return 'hazirliq_teacher_pending_v1_' + safeTeacherKey(username)}
function normalizeUsername(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,'')}
function readTeacherSession(){
  try{return JSON.parse(localStorage.getItem(TEACHER_SESSION_KEY)||'null')}catch(e){return null}
}
function writeTeacherSession(t){
  currentTeacher={username:normalizeUsername(t.username),name:t.name||t.username};
  localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(currentTeacher));
}
function clearTeacherSession(){
  currentTeacher=null;
  localStorage.removeItem(TEACHER_SESSION_KEY);
}
function readLocalState(username=currentTeacher?.username){
  try{
    const raw=localStorage.getItem(localDataKey(username));
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    return {data:normalizeData(parsed?.data), updatedAt:parsed?.updatedAt||dataUpdatedAt(parsed?.data)};
  }catch(e){
    console.warn('Local state read failed:', e);
    return null;
  }
}
function writeLocalState(){
  if(!currentTeacher?.username) return false;
  try{
    const ts=touchData();
    const payload={data:normalizeData(data), updatedAt:ts};
    localStorage.setItem(localDataKey(), JSON.stringify(payload));
    localStorage.setItem(localPendingKey(),'1');
    if($('cloudStatus')) $('cloudStatus').textContent='Cihazda saxlandı';
    return true;
  }catch(e){
    console.error('Local save failed:', e);
    toast('Cihaz yaddaşına yazmaq alınmadı. Browser storage yoxlayın.');
    return false;
  }
}
function markCloudSynced(){
  try{localStorage.removeItem(localPendingKey());}catch(e){}
}
function hasPendingLocalSync(){
  try{return localStorage.getItem(localPendingKey())==='1'}catch(e){return false}
}
async function syncToCloud(){
  // Option A: no Supabase Auth/session. Each teacher writes only to their own username row.
  // UI actions are saved locally first; cloud sync must never block the app.
  if(isHydrating || !db || !currentTeacher?.username) return false;
  if(!navigator.onLine){
    if($('cloudStatus')) $('cloudStatus').textContent='Cihazda saxlandı';
    return false;
  }
  if(cloudSyncInProgress){
    cloudSyncQueued=true;
    return false;
  }
  cloudSyncInProgress=true;
  try{
    if($('cloudStatus')) $('cloudStatus').textContent='Cloud-a yazılır';
    const localSnapshot=readLocalState();
    const snapshot=normalizeData(localSnapshot?.data || data);
    const snapshotTime=localSnapshot?.updatedAt || dataUpdatedAt(snapshot) || nowIso();
    snapshot.__updatedAt=snapshotTime;

    const {error}=await withTimeout(
      db.from('teacher_states')
        .update({data:snapshot, updated_at:snapshotTime})
        .eq('username', currentTeacher.username),
      9000,
      'Cloud save timeout'
    );
    if(error) throw error;

    const latestLocal=readLocalState();
    const latestTime=latestLocal?.updatedAt || dataUpdatedAt(latestLocal?.data);
    if(!latestLocal || latestTime===snapshotTime){
      markCloudSynced();
      if($('cloudStatus')) $('cloudStatus').textContent='Cloud saxlandı';
    }else{
      localStorage.setItem(localPendingKey(),'1');
      cloudSyncQueued=true;
      if($('cloudStatus')) $('cloudStatus').textContent='Cihazda saxlandı';
    }
    return true;
  }catch(err){
    console.error('Cloud sync failed:', err);
    try{localStorage.setItem(localPendingKey(),'1')}catch(e){}
    if($('cloudStatus')) $('cloudStatus').textContent='Cihazda saxlandı';
    return false;
  }finally{
    cloudSyncInProgress=false;
    if(cloudSyncQueued){
      cloudSyncQueued=false;
      setTimeout(()=>syncToCloud(),1200);
    }
  }
}
function scheduleCloudSync(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>syncToCloud(),700);
}
function save(){
  if(isHydrating) return;
  writeLocalState();
  scheduleCloudSync();
}
async function resumeSupabaseConnection(reason='resume'){
  // Returning from Alt+Tab/tab change does NOT reload/overwrite data.
  // It only retries pending cloud sync in the background.
  if(!db || document.hidden) return;
  if(hasPendingLocalSync()) scheduleCloudSync();
  else if($('cloudStatus')) $('cloudStatus').textContent='Cloud aktivdir';
}
function showApp(){
  $('appShell')?.classList.remove('locked');
  $('authScreen')?.classList.add('locked');
  const who=currentTeacher?.name||currentTeacher?.username;
  if(who && $('cloudStatus')) $('cloudStatus').textContent='Cloud aktivdir';
}
function showLogin(msg=''){
  $('appShell')?.classList.add('locked');
  $('authScreen')?.classList.remove('locked');
  setAuthMessage(msg);
}
async function loadCloudData(){
  if(!currentTeacher?.username){showLogin('Əvvəl müəllim girişi edin.'); return;}
  isHydrating=true;
  const local=readLocalState();
  const localTime=local?.updatedAt || dataUpdatedAt(local?.data);
  const localPending=hasPendingLocalSync();

  if(local?.data){
    data=normalizeData(local.data);
  }else{
    data={groups:[],students:[],payments:[],__updatedAt:'1970-01-01T00:00:00.000Z'};
  }

  try{
    if($('cloudStatus')) $('cloudStatus').textContent='Cloud yoxlanılır';
    const {data:row,error}=await withTimeout(
      db.from('teacher_states').select('data, updated_at, name').eq('username', currentTeacher.username).maybeSingle(),
      9000,
      'Cloud load timeout'
    );
    if(error) throw error;

    const cloudData=row?.data ? normalizeData(row.data) : null;
    const cloudTime=cloudData ? (dataUpdatedAt(cloudData) || row?.updated_at) : '1970-01-01T00:00:00.000Z';

    if(localPending && local?.data){
      data=normalizeData(local.data);
      setTimeout(()=>syncToCloud(),600);
      if($('cloudStatus')) $('cloudStatus').textContent='Cihazda saxlandı';
    }else if(cloudData && (!local || newerOrEqual(cloudTime, localTime))){
      data=cloudData;
      try{localStorage.setItem(localDataKey(), JSON.stringify({data, updatedAt:cloudTime}))}catch(e){}
      markCloudSynced();
      if($('cloudStatus')) $('cloudStatus').textContent='Cloud aktivdir';
    }else if(local?.data){
      data=normalizeData(local.data);
      try{localStorage.setItem(localPendingKey(),'1')}catch(e){}
      setTimeout(()=>syncToCloud(),600);
      if($('cloudStatus')) $('cloudStatus').textContent='Cihazda saxlandı';
    }else{
      data={groups:[],students:[],payments:[],__updatedAt:nowIso()};
      writeLocalState();
      setTimeout(()=>syncToCloud(),600);
    }
  }catch(err){
    console.warn('Cloud load failed, using local data:', err);
    if($('cloudStatus')) $('cloudStatus').textContent='Cihazda saxlandı';
  }finally{
    isHydrating=false;
    showApp();
    renderAll();
  }
}
function setAuthMessage(text,ok=false){
  const box=$('authMessage');
  if(!box) return;
  box.textContent=text||'';
  box.classList.toggle('ok',!!ok);
}
async function initSupabase(){
  if(!isSupabaseConfigured()){
    showLogin('Supabase config yazılmayıb. supabase-config.js faylını yoxlayın.');
    refreshIcons();
    return;
  }
  if(!window.supabase?.createClient){
    showLogin('Supabase kitabxanası yüklənmədi. İnternet/CDN bağlantısını yoxlayın.');
    refreshIcons();
    return;
  }
  const cfg=supabaseConfig();
  db=window.supabase.createClient(
    cfg.url,
    cfg.anonKey,
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
  );

  const saved=readTeacherSession();
  if(saved?.username){
    currentTeacher={username:normalizeUsername(saved.username),name:saved.name||saved.username};
    await loadCloudData();
  }else{
    isHydrating=true;
    showLogin('Username və kod ilə daxil olun. Müəllim hesabını admin yaradır.');
  }
  refreshIcons();
}

async function loginTeacher(username, code){
  username=normalizeUsername(username);
  code=String(code||'').trim();
  if(!username || !code) return setAuthMessage('Username və kod yazın.');
  if(!db) return setAuthMessage('Supabase hazır deyil.');
  try{
    setAuthMessage('Giriş yoxlanılır...');
    const {data:teacher,error}=await withTimeout(
      db.from('teacher_states').select('username,name,code').eq('username', username).maybeSingle(),
      9000,
      'Login timeout'
    );
    if(error) throw error;
    if(!teacher || String(teacher.code)!==code) return setAuthMessage('Username və ya kod yanlışdır.');
    writeTeacherSession({username:teacher.username,name:teacher.name||teacher.username});
    setAuthMessage('Giriş uğurludur.',true);
    await loadCloudData();
  }catch(err){
    console.error('Teacher login failed:', err);
    setAuthMessage('Giriş alınmadı. Console və Supabase table-ı yoxlayın.');
  }
}

async function unlockAdmin(){
  const pass=$('adminPassword')?.value || '';
  if(pass!==adminPassword()) return setAuthMessage('Admin şifrəsi yanlışdır.');
  $('adminPanel')?.classList.remove('locked');
  setAuthMessage('Admin panel açıldı.',true);
  await renderTeacherAdminList();
  refreshIcons();
}

async function renderTeacherAdminList(){
  const box=$('teacherAdminList');
  if(!box || !db) return;
  try{
    const {data:rows,error}=await db.from('teacher_states').select('username,name,code,updated_at').order('username');
    if(error) throw error;
    box.innerHTML=(rows||[]).map(t=>`<div class="teacherAdminRow"><div><b>${esc(t.name||t.username)}</b><span>Username: <strong>${esc(t.username)}</strong> • Kod: <strong>${esc(t.code||'')}</strong> • Yenilənib: ${esc(t.updated_at?dateAz(String(t.updated_at).slice(0,10)):'-')}</span></div><div class="teacherRowActions"><button type="button" class="mini" onclick="copyTeacherLogin('${esc(t.username)}','${esc(t.code||'')}')">Kopyala</button><button type="button" class="mini red" onclick="deleteTeacherAccount('${esc(t.username)}')">Sil</button></div></div>`).join('') || '<div class="empty smallEmpty">Müəllim yoxdur.</div>';
  }catch(err){
    console.error('Teacher list failed:', err);
    box.innerHTML='<div class="empty smallEmpty">Müəllim siyahısı yüklənmədi.</div>';
  }
}

async function createTeacherAccount(){
  const name=($('newTeacherName')?.value||'').trim();
  const username=normalizeUsername($('newTeacherUsername')?.value||'');
  const code=($('newTeacherCode')?.value||'').trim();
  if(!username || !code) return setAuthMessage('Username və kod yazın.');
  if(!db) return setAuthMessage('Supabase hazır deyil. supabase-config.js və deploy-u yoxlayın.');
  try{
    const {data:oldTeacher,error:findError}=await db.from('teacher_states').select('username').eq('username',username).maybeSingle();
    if(findError) throw findError;
    let result;
    if(oldTeacher){
      result=await db.from('teacher_states').update({name:name || username, code, updated_at:nowIso()}).eq('username',username);
    }else{
      result=await db.from('teacher_states').insert({
        username,
        name:name || username,
        code,
        data:{groups:[],students:[],payments:[],__updatedAt:'1970-01-01T00:00:00.000Z'},
        updated_at:nowIso()
      });
    }
    if(result.error) throw result.error;
    $('teacherCreateForm')?.reset();
    setAuthMessage('Müəllim yaradıldı / yeniləndi.',true);
    await renderTeacherAdminList();
  }catch(err){
    console.error('Create teacher failed:', err);
    setAuthMessage('Müəllim yaratmaq alınmadı. SQL setup-u yoxlayın.');
  }
}

window.copyTeacherLogin=async(username, code)=>{
  const text=`Username: ${username}\nKod: ${code}`;
  try{await navigator.clipboard.writeText(text);toast('Username və kod kopyalandı');}
  catch(e){alert(text);}
};
window.deleteTeacherAccount=async(username)=>{
  if(!confirm(username+' müəllimi silinsin? Bu müəllimin datası da silinəcək.')) return;
  try{
    const {error}=await db.from('teacher_states').delete().eq('username', username);
    if(error) throw error;
    await renderTeacherAdminList();
    setAuthMessage('Müəllim silindi.',true);
  }catch(err){
    console.error('Delete teacher failed:', err);
    setAuthMessage('Müəllimi silmək alınmadı.');
  }
}

function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function money(n){return Number(n||0).toFixed(0)+' AZN'}
function today(){return new Date().toISOString().slice(0,10)}
function curMonth(){return new Date().toISOString().slice(0,7)}
function active(){return data.students.filter(s=>s.status==='active')}
function group(id){return data.groups.find(g=>g.id===id)}
function student(id){return data.students.find(s=>s.id===id)}
function monthName(m){if(!m)return'-';let [y,mo]=m.split('-');return months[+mo-1]+' '+y}
function dateAz(d){
  if(!d) return '-';
  const iso=toIsoDate(d);
  if(!iso) return '-';
  const [y,m,day]=iso.split('-');
  return `${day}/${m}/${y}`;
}
function toIsoDate(v){
  if(!v) return '';
  if(v instanceof Date){
    const y=v.getFullYear();
    const m=String(v.getMonth()+1).padStart(2,'0');
    const d=String(v.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  v=String(v||'').trim();
  if(!v) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m=v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if(!m) return '';
  const day=m[1].padStart(2,'0'), mon=m[2].padStart(2,'0'), year=m[3];
  const dt=new Date(`${year}-${mon}-${day}T00:00:00`);
  if(dt.getFullYear()!=Number(year)||dt.getMonth()+1!=Number(mon)||dt.getDate()!=Number(day)) return '';
  return `${year}-${mon}-${day}`;
}
function fromIsoDate(iso){
  iso=toIsoDate(iso);
  if(!iso) return '';
  const [y,m,d]=iso.split('-');
  return `${d}/${m}/${y}`;
}
function syncDatePair(textId,pickerId){
  const text=$(textId), picker=$(pickerId);
  if(!text||!picker) return;
  picker.addEventListener('change',()=>{ text.value=fromIsoDate(picker.value); });
  text.addEventListener('input',()=>{ const iso=toIsoDate(text.value); if(iso) picker.value=iso; });
}

function parseDateParts(iso){
  const safe=toIsoDate(iso);
  if(!safe) return null;
  const [y,m,d]=safe.split('-').map(Number);
  return {y,m,d};
}
function monthStartDate(iso){
  const p=parseDateParts(iso||today());
  return new Date(p.y,p.m-1,1);
}
function setInputDateValue(targetId, iso){
  const el=$(targetId); if(!el) return;
  el.value=fromIsoDate(iso);
}
function openDatePicker(targetId){
  pickerState.dateTarget=targetId;
  const current=toIsoDate($(targetId)?.value) || today();
  pickerState.tempDate=current;
  pickerState.monthCursor=monthStartDate(current);
  const titles={joinDate:'Qoşulduğu tarixi seç',quickPaymentDate:'Sürətli ödəniş tarixi',paymentDate:'Ödəniş tarixini seç'};
  if($('datePickerTitle')) $('datePickerTitle').textContent=titles[targetId]||'Tarix seç';
  renderDatePicker();
  $('datePickerModal')?.classList.remove('hidden');
  refreshIcons();
}
function closeDatePicker(){ $('datePickerModal')?.classList.add('hidden'); }
function renderDatePicker(){
  const base=pickerState.monthCursor || monthStartDate(today());
  if($('calendarMonthLabel')) $('calendarMonthLabel').textContent=`${monthNames[base.getMonth()]} ${base.getFullYear()}`;
  const daysWrap=$('calendarDays'); if(!daysWrap) return;
  const first=new Date(base.getFullYear(),base.getMonth(),1);
  const startOffset=(first.getDay()+6)%7;
  const total=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
  let html='';
  for(let i=0;i<startOffset;i++) html+='<span class="calendarDay placeholder"></span>';
  for(let d=1; d<=total; d++){
    const iso=toIsoDate(new Date(base.getFullYear(),base.getMonth(),d));
    const cls=['calendarDay'];
    if(iso===pickerState.tempDate) cls.push('selected');
    if(iso===today()) cls.push('today');
    html+=`<button type="button" class="${cls.join(' ')}" data-date-value="${iso}">${String(d).padStart(2,'0')}</button>`;
  }
  daysWrap.innerHTML=html;
}
function renderModalScheduleList(){
  const wrap=$('modalScheduleList');
  if(!wrap) return;
  if(!pickerState.scheduleItems.length){
    wrap.innerHTML='<div class="empty">Seçilmiş günlər burada görünəcək.</div>';
    return;
  }
  wrap.innerHTML=pickerState.scheduleItems.map((item,idx)=>`<div class="modalScheduleItem"><div><b>${esc(item.day)}</b><span>${esc(item.start)} - ${esc(item.end)}</span></div><button type="button" class="mini red" data-remove-schedule="${idx}">Sil</button></div>`).join('');
}
function renderTimeWheels(){
  const startWrap=$('scheduleStartWheel');
  const endWrap=$('scheduleEndWheel');
  const times=timeList();
  if(startWrap) startWrap.innerHTML=times.map(t=>`<button type="button" class="wheelTime ${pickerState.schedule.start===t?'active':''}" data-sched-start="${t}">${t}</button>`).join('');
  if(endWrap) endWrap.innerHTML=times.map(t=>`<button type="button" class="wheelTime ${pickerState.schedule.end===t?'active':''}" data-sched-end="${t}">${t}</button>`).join('');
  if($('selectedStartTimeLabel')) $('selectedStartTimeLabel').textContent=pickerState.schedule.start || 'Seçilməyib';
  if($('selectedEndTimeLabel')) $('selectedEndTimeLabel').textContent=pickerState.schedule.end || 'Seçilməyib';
}
function hideTimePalette(){ pickerState.activeTimeField=null; }
function initSchedulePicker(){
  const dayWrap=$('scheduleDayChips');
  if(dayWrap) dayWrap.innerHTML=days.map(day=>`<button type="button" class="chipOption ${pickerState.schedule.day===day?'active':''}" data-sched-day="${day}"><span>${dayShort[day]||day}</span><small>${day}</small></button>`).join('');
  renderTimeWheels();
  renderModalScheduleList();
}

function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1800)}
function cleanDate(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
function addMonths(date,count){const d=new Date(date);const originalDay=d.getDate();d.setMonth(d.getMonth()+count);if(d.getDate()!==originalDay)d.setDate(0);return d;}
function timeToMinutes(t){if(!t)return 0;const [h,m]=String(t).split(':').map(Number);return (h||0)*60+(m||0)}
function durationMinutes(start,end){return Math.max(timeToMinutes(end)-timeToMinutes(start),0)}
function durationText(start,end){const mins=durationMinutes(start,end);const h=Math.floor(mins/60);const m=mins%60;if(h&&m)return `${h} saat ${m} dəq`;if(h)return `${h} saat`;return `${m} dəq`;}
function todayDayName(){return days[(new Date().getDay()+6)%7]}
function totalHoursText(minutes){const h=Math.floor(minutes/60);const m=minutes%60;if(h&&m)return `${h} saat ${m} dəq`;if(h)return `${h} saat`;return `${m} dəq`;}

/*
Payment logic used in this version:
- A student starts a monthly period on the join date.
- The active/current period is counted as "Bu ay alınacaq məbləğ".
- Finished periods that were not fully paid move to "1 aydan artıq ödənməyən pul".
- Payments are applied to older finished periods first, then to the current period.
Example: joined 04 Apr, today 05 May, fee 70:
  04 Apr - 04 May -> old unpaid amount
  04 May - 04 Jun -> current amount
*/
function studentFinance(s, referenceDate=new Date()){
  const fee=Number(s.fee||0);
  const now=cleanDate(referenceDate);
  const join=cleanDate(s.joinDate);

  if(!s.joinDate || fee<=0 || now < join){
    return {fee, paid:0, oldDebt:0, debt:0, expected:0, currentCharge:0, oldCharges:0, nextDue:addMonths(new Date(),1), overdueCount:0, nextCovered:false};
  }

  const paidTotal=data.payments
    .filter(p=>p.studentId===s.id)
    .reduce((a,p)=>a+Number(p.amount||0),0);

  // Finished periods become old debt only after the end date has passed.
  // On the exact end date it is still counted as current, next day it becomes old.
  let finishedPeriods=0;
  while(cleanDate(addMonths(join, finishedPeriods+1)) < now){
    finishedPeriods++;
  }

  const oldCharges=finishedPeriods * fee;
  const currentCharge=fee;
  const nextDue=addMonths(join, finishedPeriods+1);

  const oldDebt=Math.max(oldCharges - paidTotal, 0);
  const remainingAfterOld=Math.max(paidTotal - oldCharges, 0);
  const expected=Math.max(currentCharge - remainingAfterOld, 0);
  const nextCovered=remainingAfterOld >= currentCharge;

  return {
    fee,
    paid:paidTotal,
    oldDebt,
    debt:oldDebt,
    expected,
    currentCharge,
    oldCharges,
    nextDue,
    overdueCount:finishedPeriods,
    nextCovered
  };
}

function monthlyMaximum(gid='all'){
  return active()
    .filter(s=>gid==='all'||s.groupId===gid)
    .reduce((a,s)=>a+Number(s.fee||0),0);
}
function totalExpected(gid='all'){
  return active()
    .filter(s=>gid==='all'||s.groupId===gid)
    .reduce((a,s)=>a+studentFinance(s).expected,0);
}
function totalDebt(gid='all'){
  return active()
    .filter(s=>gid==='all'||s.groupId===gid)
    .reduce((a,s)=>a+studentFinance(s).debt,0);
}
function totalPaid(gid='all',method='all'){
  return data.payments
    .filter(p=>method==='all'||p.method===method)
    .filter(p=>gid==='all'||student(p.studentId)?.groupId===gid)
    .reduce((a,p)=>a+Number(p.amount||0),0);
}
function paidThisMonth(method='all'){
  const m=curMonth();
  return data.payments
    .filter(p=>(p.date||'').slice(0,7)===m)
    .filter(p=>method==='all'||p.method===method)
    .reduce((a,p)=>a+Number(p.amount||0),0);
}

function studentStatusHtml(s){
  const f=studentFinance(s);
  if(f.debt>0)return '<span class="badge late">1+ ay ödənməyən</span>';
  if(f.expected>0)return '<span class="badge wait">Gözlənilir</span>';
  return '<span class="badge paid">Ödənib</span>';
}
function methodHtml(method){
  const icon = method==='cash' ? 'wallet' : 'credit-card';
  const label = method==='cash' ? 'Nəğd' : 'Kart';
  return `<span class="methodTag"><i data-lucide="${icon}"></i><span>${label}</span></span>`;
}
function refreshIcons(){if(window.lucide&&typeof window.lucide.createIcons==='function'){window.lucide.createIcons();}}
function timeOptions(sel=''){
  let out='<option value="">Saat seç</option>';
  for(let h=7;h<=22;h++)for(let m of [0,30]){
    let v=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
    out+=`<option ${v===sel?'selected':''}>${v}</option>`;
  }
  return out;
}
function renderExternalScheduleRows(list){
  $('scheduleRows').innerHTML='';
  (list||[]).forEach(item=>{
    let div=document.createElement('div');
    div.className='scheduleRow';
    div.innerHTML=`<div class="scheduleCardItem"><div class="scheduleCardMain"><span class="scheduleDayText">${esc(item.day||'Gün seçilməyib')}</span><span class="scheduleTimeText">${item.start&&item.end ? `${item.start} - ${item.end}` : 'Saat seçilməyib'}</span></div><button type="button" class="mini red" aria-label="Sil">Sil</button><input type="hidden" class="schDay" value="${esc(item.day||'')}"><input type="hidden" class="schStart" value="${esc(item.start||'')}"><input type="hidden" class="schEnd" value="${esc(item.end||'')}"></div>`;
    div.querySelector('button').onclick=()=>div.remove();
    $('scheduleRows').appendChild(div);
  });
}
function addSchedule(day='',start='',end=''){
  const current=getSchedule();
  current.push({day,start,end});
  renderExternalScheduleRows(current);
}
function getSchedule(){
  return [...document.querySelectorAll('.scheduleRow')].map(r=>({day:r.querySelector('.schDay').value,start:r.querySelector('.schStart').value,end:r.querySelector('.schEnd').value}));
}
function resetScheduleModal(){ pickerState.schedule={day:'',start:'',end:''}; pickerState.activeTimeField=null; pickerState.scheduleItems=getSchedule().map(x=>({...x})); initSchedulePicker(); }
function openScheduleModal(){ resetScheduleModal(); $('scheduleModal')?.classList.remove('hidden'); refreshIcons(); }
function closeScheduleModal(){ $('scheduleModal')?.classList.add('hidden'); hideTimePalette(); }
function scheduleText(g){return (g.schedule||[]).map(s=>`${s.day}: ${s.start}-${s.end}`).join(', ')||'Dərs günü yoxdur'}
function table(head,rows,empty='Məlumat yoxdur'){
  if(!rows.length)return `<div class="empty">${empty}</div>`;
  return `<div class="tableWrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function pillHtml(p){
  const text=String(p||'');
  const parts=text.split(':');
  const label=parts.length>1?parts[0].trim():text;
  const value=parts.length>1?parts.slice(1).join(':').trim():'';
  const numericValue = Number(String(value).replace(/[^0-9.-]/g,'')) || 0;
  let cls='info', icon='info';
  if(text.toLowerCase().includes('bu ay')){cls='expected'; icon='calendar-check'}
  if(text.includes('1+')){cls = numericValue > 0 ? 'debt' : 'clearDebt'; icon = numericValue > 0 ? 'circle-alert' : 'check-circle-2'}
  if(text.toLowerCase().includes('aylıq')){cls='monthly'; icon='wallet'}
  return `<span class="pill metricPill ${cls}"><i data-lucide="${icon}"></i><span><small>${esc(label)}</small>${value?`<b>${esc(value)}</b>`:''}</span></span>`;
}
function acc(id,title,sub,pills,body,open=false){
  return `<div class="accordion ${open?'open':''}" id="${id}">
    <button type="button" class="accHead" onclick="toggle('${id}')">
      <div class="accMain">
        <b>${title}</b>
        <span class="accSub">${sub}</span>
      </div>
      <div class="accHeadMeta">
        <div class="pills metricPills">${pills.map(pillHtml).join('')}</div>
        <span class="accIndicator" aria-hidden="true">
          <span class="accToggleClosed">Ətraflı</span>
          <span class="accToggleOpen">Gizlət</span>
          <span class="accChevron">⌄</span>
        </span>
      </div>
    </button>
    <div class="accBody">${body}</div>
  </div>`
}
window.toggle=x=>$(x).classList.toggle('open');

function scheduleSessions(){
  return data.groups.flatMap(g=>(g.schedule||[]).map(s=>({
    groupId:g.id,
    groupName:g.name,
    note:g.note||'',
    day:s.day,
    start:s.start,
    end:s.end,
    students:active().filter(st=>st.groupId===g.id).length,
    minutes:durationMinutes(s.start,s.end)
  }))).sort((a,b)=>days.indexOf(a.day)-days.indexOf(b.day)||timeToMinutes(a.start)-timeToMinutes(b.start)||a.groupName.localeCompare(b.groupName,'az'));
}

function fillSelects(){
  let gs=data.groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
  $('studentGroup').innerHTML='<option value="">Qrup seç</option>'+(gs||'');
  if(!data.groups.length) $('studentGroup').innerHTML='<option value="">Əvvəl qrup yaradın</option>';
  const currentReport = $('reportGroup')?.value || 'all';
  $('reportGroup').innerHTML='<option value="all">Bütün qruplar</option>'+gs;
  if ([...$('reportGroup').options].some(o=>o.value===currentReport)) $('reportGroup').value = currentReport;
  $('paymentStudent').innerHTML='<option value="">Şagird seç</option>'+active().map(s=>{
    const f=studentFinance(s);
    return `<option value="${s.id}">${esc(s.name)} — ${esc(group(s.groupId)?.name||'Qrupsuz')} — Bu ay alınacaq: ${money(f.expected)}</option>`;
  }).join('');
  if(!active().length) $('paymentStudent').innerHTML='<option value="">Aktiv şagird yoxdur</option>';
}

function renderHome(){
  $('stActive').textContent=active().length;
  $('stPaid').textContent=money(paidThisMonth());
  $('stExpected').textContent=money(totalExpected());
  $('stDebt').textContent=money(totalDebt());
  $('homeGroups').innerHTML=groupAccordions(false);
  renderHomeSchedulePreview();
}

function renderHomeSchedulePreview(){
  const el=$('homeSchedulePreview');
  if(!el)return;
  const sessions=scheduleSessions();
  if(!sessions.length){
    el.innerHTML='<div class="empty">Hələ cədvəl üçün dərs günü əlavə edilməyib.</div>';
    return;
  }
  el.innerHTML=`<div class="schedulePreview">${days.map(day=>{
    const ds=sessions.filter(s=>s.day===day);
    return `<div class="schedulePreviewDay">
      <div class="schedulePreviewHead">
        <b>${day}</b>
        <span class="schedulePreviewCount">${ds.length}</span>
      </div>
      ${ds.length?ds.slice(0,3).map(s=>`<div class="previewItem"><strong>${esc(s.groupName)}</strong><span>${s.start} - ${s.end}</span></div>`).join('') + (ds.length>3?`<div class="moreTag">+${ds.length-3} daha</div>`:''):'<div class="empty">Dərs yoxdur</div>'}
    </div>`;
  }).join('')}</div>`;
}

function groupAccordions(onlyDebt=false){
  if(!data.groups.length)return '<div class="empty">Hələ qrup yoxdur.</div>';
  return data.groups.map((g,i)=>{
    let ss=active().filter(s=>s.groupId===g.id);
    if(onlyDebt)ss=ss.filter(s=>studentFinance(s).debt>0);
    let rows=ss.sort((a,b)=>studentFinance(a).nextDue-studentFinance(b).nextDue).map(s=>{
      const f=studentFinance(s);
      return `<tr>
        <td><b>${esc(s.name)}</b><br>${esc(s.phone||'')}</td>
        <td>${dateAz(f.nextDue)}</td>
        <td>${money(f.fee)}</td>
        <td>${money(f.paid)}</td>
        <td>${money(f.expected)}</td>
        <td>${money(f.debt)}</td>
        <td>${studentStatusHtml(s)}</td>
      </tr>`;
    });
    return acc(
      'gacc'+g.id+onlyDebt,
      esc(g.name),
      scheduleText(g),
      [`Bu ay alınacaq: ${money(totalExpected(g.id))}`,`1+ ay ödənməyən: ${money(totalDebt(g.id))}`],
      table(['Şagird','Növbəti tarix','Aylıq','Ödənilib','Bu ay','1+ ay ödənməyən','Status'],rows,'Bu qrupda məlumat yoxdur.'),
      i===0
    )
  }).join('');
}

function renderGroups(){
  $('groupList').innerHTML=data.groups.map(g=>`<div class="accordion open"><div class="accHead"><div><b>${esc(g.name)}</b><br>${scheduleText(g)}</div><div><button class="mini" onclick="editGroup('${g.id}')">Dəyiş</button> <button class="mini red" onclick="deleteGroup('${g.id}')">Sil</button></div></div></div>`).join('')||'<div class="empty">Qrup yoxdur.</div>'
}

function scheduleColor(index){
  const palettes=[
    ['#eff6ff','#dbeafe'],
    ['#ecfeff','#cffafe'],
    ['#f5f3ff','#e9d5ff'],
    ['#fdf2f8','#fbcfe8'],
    ['#ecfdf5','#bbf7d0'],
    ['#fff7ed','#fed7aa'],
    ['#eef2ff','#c7d2fe']
  ];
  return palettes[index % palettes.length];
}

function buildTimeSlots(sessions){
  if(!sessions.length) return {startMin:8*60,endMin:14*60,slots:['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30']};
  const minStart=Math.min(...sessions.map(s=>timeToMinutes(s.start)));
  const maxEnd=Math.max(...sessions.map(s=>timeToMinutes(s.end)));
  let startMin=Math.min(8*60, Math.floor(minStart/30)*30);
  let endMin=Math.max(18*60, Math.ceil(maxEnd/30)*30);
  if(endMin<=startMin) endMin=startMin+60;
  const slots=[];
  for(let t=startMin;t<endMin;t+=30){
    const hh=String(Math.floor(t/60)).padStart(2,'0');
    const mm=String(t%60).padStart(2,'0');
    slots.push(`${hh}:${mm}`);
  }
  return {startMin,endMin,slots};
}

function renderSchedule(){
  const mount=$('weekSchedule');
  if(!mount) return;
  const sessions=scheduleSessions();

  if(!sessions.length){
    mount.innerHTML='<div class="empty">Cədvəli görmək üçün əvvəl qruplara dərs günləri əlavə edin.</div>';
    return;
  }

  const visibleDays=days;
  const {startMin,endMin,slots}=buildTimeSlots(sessions);
  const slotHeight=62;
  const totalHeight=slots.length*slotHeight;

  const legendItems=data.groups.slice(0,10).map((g,i)=>{
    const [a,b]=scheduleColor(i);
    return `<span class="legendChip"><span class="legendSwatch" style="background:linear-gradient(135deg, ${a}, ${b})"></span>${esc(g.name)}</span>`;
  }).join('');

  const header=visibleDays.map(day=>{
    const ds=sessions.filter(s=>s.day===day);
    return `<div class="timetableHeaderCell"><b>${day}</b><span>${ds.length?ds.length+' dərs':'Boş gün'}</span></div>`;
  }).join('');

  const timeColumn=`<div class="timeColumn">${slots.map(t=>`<div class="timeCell">${t}</div>`).join('')}</div>`;

  const dayColumns=visibleDays.map(day=>{
    const ds=sessions.filter(s=>s.day===day);
    const lines=slots.map(()=>'<div class="slotLine"></div>').join('');
    const blocks=ds.map(s=>{
      const groupIndex=Math.max(data.groups.findIndex(g=>g.id===s.groupId),0);
      const [c1,c2]=scheduleColor(groupIndex);
      const top=((timeToMinutes(s.start)-startMin)/30)*slotHeight + 6;
      const height=((timeToMinutes(s.end)-timeToMinutes(s.start))/30)*slotHeight - 12;
      return `<div class="sessionBlock" style="top:${top}px;height:${Math.max(height,44)}px;background:linear-gradient(180deg, ${c1}, ${c2});">
        <div class="sessionBlockInner">
          <span class="blockTime">${s.start} - ${s.end}</span>
          <h4>${esc(s.groupName)}</h4>
          <p>${durationText(s.start,s.end)}${s.note?` • ${esc(s.note)}`:''}</p>
          <div class="blockMeta">
            <span><i data-lucide="users-round"></i>${s.students} şagird</span>
            <span><i data-lucide="clock-3"></i>${durationText(s.start,s.end)}</span>
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div class="dayColumn" style="height:${totalHeight}px">${lines}<div class="dayColumnOverlay">${blocks}</div></div>`;
  }).join('');

  mount.innerHTML=`
    <div class="timetableLegend">${legendItems}</div>
    <div class="timetableWrap">
      <div class="timetable">
        <div class="timetableHeader">
          <div class="timetableHeaderCell timeColHead">Saat</div>
          ${header}
        </div>
        <div class="timetableMain">
          ${timeColumn}
          ${dayColumns}
        </div>
      </div>
    </div>
    <div class="smallNote">Qeyd: Cədvəl qruplarda daxil etdiyiniz gün və saatlara əsasən avtomatik qurulur.</div>`;
}

function renderStudents(){
  let q=$('studentSearch').value.toLowerCase();
  let html=data.groups.map((g,i)=>{
    let ss=data.students.filter(s=>s.groupId===g.id).filter(s=>s.name.toLowerCase().includes(q));
    let rows=ss.map(s=>{
      const f=studentFinance(s);
      return `<tr>
        <td><b>${esc(s.name)}</b><br>${esc(s.phone||'')}</td>
        <td>${money(s.fee)}</td>
        <td>${dateAz(s.joinDate)}</td>
        <td>${dateAz(f.nextDue)}</td>
        <td>${money(f.expected)}</td>
        <td>${money(f.debt)}</td>
        <td>${studentStatusHtml(s)}</td>
        <td><button class="mini" onclick="editStudent('${s.id}')">Dəyiş</button> <button class="mini red" onclick="deleteStudent('${s.id}')">Sil</button></td>
      </tr>`;
    });
    return acc('sg'+g.id,esc(g.name),ss.length+' şagird',[`Bu ay alınacaq: ${money(totalExpected(g.id))}`,`1+ ay ödənməyən: ${money(totalDebt(g.id))}`],table(['Şagird','Aylıq','Başlama','Növbəti tarix','Bu ay alınacaq','1+ ay ödənməyən','Status','Əməliyyat'],rows,'Bu qrupda şagird yoxdur.'),i===0)
  }).join('');
  $('studentList').innerHTML=html||'<div class="empty">Qrup yoxdur.</div>';
}


function renderQuickPaymentGroups(){
  const mount=$('quickPaymentGroups');
  if(!mount) return;
  const query=($('paymentSearch')?.value||'').trim().toLowerCase();
  const groups=data.groups || [];
  if(!groups.length){ mount.innerHTML='<div class="empty">Ödəniş üçün əvvəl qrup və şagird yaradın.</div>'; return; }
  const html=groups.map((g,i)=>{
    const students=active().filter(s=>s.groupId===g.id).filter(s=>!query || String(s.name||'').toLowerCase().includes(query));
    if(!students.length && query) return '';
    const rows=students.map(s=>{
      const f=studentFinance(s);
      const inputId='qp_'+s.id;
      const debtClear = Number(f.debt||0) <= 0;
      return `<div class="quickPayRow improvedPayRow">
        <div class="quickPayStudent">
          <b>${esc(s.name)}</b>
          <span class="monthlyInline">Aylıq ödəniş: <strong>${money(s.fee)}</strong></span>
        </div>
        <div class="quickPayOptions actionAmountOptions" aria-label="Şagird ödəniş seçimləri">
          <button type="button" class="amountChoice actionAmount expected" onclick="setQuickPaymentAmount('${inputId}', ${Number(f.expected||0)})"><small>Bu ay alınacaq</small><strong>${money(f.expected)}</strong></button>
          <button type="button" class="amountChoice actionAmount ${debtClear?'clearDebt':'debt'}" onclick="setQuickPaymentAmount('${inputId}', ${Number(f.debt||0)})"><small>${debtClear?'Keçən aydan qalan borcu yoxdur':'1+ ay borc'}</small><strong>${money(f.debt)}</strong></button>
        </div>
        <div class="quickPayActions">
          <input id="${inputId}" type="number" min="0" placeholder="Məbləği daxil edin">
          <button type="button" class="primary miniPrimary" onclick="addQuickPayment('${s.id}','${inputId}')">Yadda saxla</button>
        </div>
      </div>`;
    }).join('');
    return acc('pay_'+g.id, esc(g.name), `${students.length} şagird`, [`Bu ay alınacaq: ${money(totalExpected(g.id))}`,`1+ ay ödənməyən: ${money(totalDebt(g.id))}`], rows || '<div class="empty">Bu qrupda aktiv şagird yoxdur.</div>', i===0);
  }).join('');
  mount.innerHTML=html || '<div class="empty">Axtarışa uyğun şagird tapılmadı.</div>';
  refreshIcons();
}

function renderPayments(){
  const mount=$('paymentList');
  if(!mount) return;
  const rows=[...(data.payments||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(p=>{
    const s=student(p.studentId);
    const g=s?group(s.groupId):null;
    return `<tr>
      <td><b>${esc(s?.name||'Silinmiş şagird')}</b><br>${esc(g?.name||'-')}</td>
      <td>${money(p.amount)}</td>
      <td>${dateAz(p.date)}</td>
      <td>${methodHtml(p.method)}</td>
      <td>${esc(p.note||'')}</td>
      <td><button class="mini red" onclick="deletePayment('${p.id}')">Sil</button></td>
    </tr>`;
  });
  mount.innerHTML=table(['Şagird','Məbləğ','Tarix','Üsul','Qeyd','Əməliyyat'],rows,'Hələ ödəniş yoxdur.');
  refreshIcons();
}

function renderReport(){
  const gid=$('reportGroup')?.value || 'all';
  if($('rpExpected')) $('rpExpected').textContent=money(totalExpected(gid));
  if($('rpPaid')) $('rpPaid').textContent=money(totalPaid(gid));
  if($('rpDebt')) $('rpDebt').textContent=money(totalDebt(gid));
  if($('rpCashCard')) $('rpCashCard').textContent=`${money(totalPaid(gid,'cash'))} / ${money(totalPaid(gid,'card'))}`;
  const students=active().filter(s=>gid==='all'||s.groupId===gid);
  const rows=students.map(s=>{
    const f=studentFinance(s);
    return `<tr>
      <td><b>${esc(s.name)}</b><br>${esc(group(s.groupId)?.name||'-')}</td>
      <td>${money(s.fee)}</td>
      <td>${dateAz(s.joinDate)}</td>
      <td>${dateAz(f.nextDue)}</td>
      <td>${money(f.expected)}</td>
      <td>${money(f.debt)}</td>
      <td>${money(f.paid)}</td>
    </tr>`;
  });
  if($('reportList')) $('reportList').innerHTML=table(['Şagird','Aylıq','Başlama','Növbəti tarix','Bu ay','1+ ay','Ümumi ödənilib'],rows,'Hesabat üçün şagird yoxdur.');
  refreshIcons();
}

function renderAll(){
  fillSelects();
  renderHome();
  renderGroups();
  renderSchedule();
  renderStudents();
  renderQuickPaymentGroups();
  renderPayments();
  renderReport();
  refreshIcons();
}

function setQuickPaymentAmount(inputId, amount){
  const input=$(inputId);
  if(!input) return;
  input.value = Number(amount||0) > 0 ? Number(amount||0) : '';
  input.focus();
}
window.setQuickPaymentAmount=setQuickPaymentAmount;

function addQuickPayment(studentId, amountInputId){
  const s = student(studentId);
  if(!s) return alert('Şagird tapılmadı.');
  const input = $(amountInputId);
  const amount = Number(input.value || 0);
  if(amount <= 0) return alert('Məbləği düzgün yazın.');
  const payDate=toIsoDate($('quickPaymentDate').value);
  if(!payDate) return alert('Ödəniş tarixini Gün/Ay/İl formatında yazın. məsələn 05/05/2025');
  if(!$('quickPaymentMethod').value) return alert('Ödəniş üsulunu seçin.');
  data.payments.push({id:id(),studentId:studentId,amount:amount,date:payDate,method:$('quickPaymentMethod').value,note:''});
  input.value = '';
  persistAndRender('Ödəniş yadda saxlandı');
}

function fillQuickAmount(studentId, inputId, type){
  const s = student(studentId);
  if(!s) return;
  const f = studentFinance(s);
  const input = $(inputId);
  if(!input) return;
  if(type==='monthly') input.value = Number(s.fee||0) || '';
  else if(type==='expected') input.value = Number(f.expected||0) || '';
  else if(type==='debt') input.value = Number(f.debt||0) || '';
}

function persistAndRender(message){
  renderAll();
  save();
  if(message) toast(message);
}

window.editGroup=id=>{let g=group(id); if(!g)return;$('groupId').value=g.id;$('groupName').value=g.name;$('groupNote').value=g.note||'';renderExternalScheduleRows(g.schedule||[]);openPage('groups')}
window.deleteGroup=id=>{if(data.students.some(s=>s.groupId===id))return alert('Bu qrupda şagird var. Əvvəl şagirdləri silin və ya başqa qrupa keçirin.'); if(confirm('Qrup silinsin?')){data.groups=data.groups.filter(g=>g.id!==id);persistAndRender('Qrup silindi')}}
window.editStudent=id=>{let s=student(id); if(!s)return;$('studentId').value=s.id;$('studentName').value=s.name;$('studentPhone').value=s.phone||'';$('parentPhone').value=s.parent||'';$('studentGroup').value=s.groupId;$('joinDate').value=fromIsoDate(s.joinDate); $('monthlyFee').value=s.fee;$('studentStatus').value=s.status;openPage('students')}
window.deleteStudent=id=>{if(confirm('Şagird silinsin?')){data.students=data.students.filter(s=>s.id!==id);persistAndRender('Şagird silindi')}}
window.deletePayment=id=>{if(confirm('Ödəniş silinsin?')){data.payments=data.payments.filter(p=>p.id!==id);persistAndRender('Ödəniş silindi')}}

function pageMeta(p){
  return {
    home:['Ana səhifə','Bu ay üçün alınmalı məbləğ, ödənişlər və ümumi görünüş.'],
    groups:['Qruplar','Hər qrup üçün dərs günləri və saatları rahat idarə olunur.'],
    schedule:['Cədvəl','Həftəlik dərs planını günlər üzrə aydın və rahat görün.'],
    students:['Şagirdlər','Şagirdləri qrup-qrupla izləyin və idarə edin.'],
    payments:['Ödənişlər','Ödənişləri qrup və şagird üzrə sürətli şəkildə əlavə edin.'],
    reports:['Hesabat','Seçilən qrupa görə əsas göstəricilər avtomatik yenilənir.']
  }[p] || null;
}

function closeMobileNav(){
  // Drawer removed in v11. Kept as a safe no-op for older calls.
  document.body.classList.remove('nav-open');
}

function openMobileNav(){
  // Drawer removed in v11. Mobile uses fixed bottom tabs instead.
}

function openPage(p){
  const meta=pageMeta(p);
  const target=$(p);
  if(!meta || !target) return;

  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active', x.id===p));
  document.querySelectorAll('.nav, .bottomTab').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
  $('title').textContent=meta[0];
  $('help').textContent=meta[1];

  // Keep the selected page stable on mobile. Do not rebuild the whole UI here,
  // because Safari can cancel the tapped menu item while the drawer is closing.
  refreshIcons();
  closeMobileNav();
  window.scrollTo({top:0,behavior:'smooth'});
}

document.addEventListener('DOMContentLoaded',()=>{
  window.addEventListener('pageshow',()=>resumeSupabaseConnection('pageshow'));
  window.addEventListener('online',()=>resumeSupabaseConnection('online'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) resumeSupabaseConnection('visibilitychange')});

  // v11: Mobile drawer removed completely. Navigation is now direct single-tap.
  document.addEventListener('click',(e)=>{
    const btn=e.target.closest('.nav[data-page], .bottomTab[data-page]');
    if(!btn) return;
    e.preventDefault();
    openPage(btn.dataset.page);
  });

  document.querySelectorAll('.authTab').forEach(tab=>tab.onclick=()=>{
    document.querySelectorAll('.authTab').forEach(x=>x.classList.toggle('active',x===tab));
    document.querySelectorAll('.authPane').forEach(x=>x.classList.toggle('active',x.dataset.authPane===tab.dataset.authTab));
    setAuthMessage('');
    refreshIcons();
  });
  $('authForm').onsubmit=async(e)=>{
    e.preventDefault();
    await loginTeacher($('teacherUsername')?.value, $('teacherCode')?.value);
  };
  if($('adminUnlockForm')) $('adminUnlockForm').onsubmit=async(e)=>{e.preventDefault();await unlockAdmin();};
  if($('teacherCreateForm')) $('teacherCreateForm').onsubmit=async(e)=>{e.preventDefault();await createTeacherAccount();};
  $('logoutBtn').onclick=()=>{
    clearTeacherSession();
    data={groups:[],students:[],payments:[]};
    showLogin('Çıxış edildi. Username və kod ilə daxil olun.');
    refreshIcons();
  };
  if($('openSchedulePicker')) $('openSchedulePicker').onclick=()=>openScheduleModal();
  $('paymentSearch').oninput=renderQuickPaymentGroups;
  $('reportGroup').onchange=()=>renderReport();
  setInputDateValue('quickPaymentDate', today());
  $('quickPaymentMethod').onchange=renderQuickPaymentGroups;
  $('quickPaymentDate').onchange=renderQuickPaymentGroups;
  $('clearGroup').onclick=()=>{$('groupForm').reset();$('groupId').value='';renderExternalScheduleRows([]);};
  $('clearStudent').onclick=()=>{$('studentForm').reset();$('studentId').value=''; setInputDateValue('joinDate', today()); $('studentGroup').value=''; $('studentStatus').value='';};
  $('studentSearch').oninput=renderStudents;
  $('groupForm').onsubmit=e=>{
    e.preventDefault();
    let sched=getSchedule();
    if(!sched.length)return alert('Ən azı bir dərs günü seçin.');
    if(sched.some(s=>!s.day||!s.start||!s.end))return alert('Dərs günü, başlama saatı və bitmə saatını seçin.');
    if(sched.some(s=>s.end<=s.start))return alert('Bitmə saatı başlama saatından sonra olmalıdır.');
    let gid=$('groupId').value||id();
    let g={id:gid,name:$('groupName').value.trim(),schedule:sched,note:$('groupNote').value.trim()};
    let i=data.groups.findIndex(x=>x.id===gid); i>=0?data.groups[i]=g:data.groups.push(g);
    $('clearGroup').click();persistAndRender('Qrup yadda saxlandı');
  };
  $('studentForm').onsubmit=e=>{
    e.preventDefault();
    if(!data.groups.length)return alert('Əvvəl qrup yaradın.');
    let sid=$('studentId').value||id();
    const joinDate=toIsoDate($('joinDate').value);
    if(!$('studentGroup').value) return alert('Qrup seçin.');
    if(!joinDate) return alert('Qoşulduğu tarixi Gün/Ay/İl formatında yazın. məsələn 05/05/2025');
    if(!$('studentStatus').value) return alert('Status seçin.');
    let s={id:sid,name:$('studentName').value.trim(),phone:$('studentPhone').value.trim(),parent:$('parentPhone').value.trim(),groupId:$('studentGroup').value,joinDate:joinDate,fee:Number($('monthlyFee').value),status:$('studentStatus').value};
    let i=data.students.findIndex(x=>x.id===sid); i>=0?data.students[i]=s:data.students.push(s);
    $('clearStudent').click();persistAndRender('Şagird yadda saxlandı');
  };
  $('paymentForm').onsubmit=e=>{
    e.preventDefault();
    let sid=$('paymentStudent').value;
    if(!sid)return alert('Şagird seçin.');
    const paymentDate=toIsoDate($('paymentDate').value);
    if(!paymentDate) return alert('Ödəniş tarixini Gün/Ay/İl formatında yazın. məsələn 05/05/2025');
    if(!$('paymentMethod').value) return alert('Ödəniş üsulunu seçin.');
    data.payments.push({id:id(),studentId:sid,amount:Number($('paymentAmount').value),date:paymentDate,method:$('paymentMethod').value,note:$('paymentNote').value.trim()});
    $('paymentForm').reset(); setInputDateValue('paymentDate', today()); persistAndRender('Ödəniş yazıldı');
  };
  if($('exportData')) $('exportData').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='hazirliq-melumatlari.json';a.click();};
  if($('clearAll')) $('clearAll').onclick=()=>{if(confirm('Bütün məlumatlar silinsin?')){data={groups:[],students:[],payments:[]};persistAndRender('Bütün məlumatlar silindi')}};
  setInputDateValue('joinDate', today()); setInputDateValue('paymentDate', today()); setInputDateValue('quickPaymentDate', today()); document.querySelectorAll('[data-date-target]').forEach(btn=>btn.onclick=()=>openDatePicker(btn.dataset.dateTarget)); ['joinDate','paymentDate','quickPaymentDate'].forEach(id=>$(id)?.addEventListener('blur',()=>{ const iso=toIsoDate($(id).value); if(iso) $(id).value=fromIsoDate(iso); })); if($('closeDatePickerModal')) $('closeDatePickerModal').onclick=closeDatePicker; if($('prevCalendarMonth')) $('prevCalendarMonth').onclick=()=>{ pickerState.monthCursor=new Date(pickerState.monthCursor.getFullYear(),pickerState.monthCursor.getMonth()-1,1); renderDatePicker(); }; if($('nextCalendarMonth')) $('nextCalendarMonth').onclick=()=>{ pickerState.monthCursor=new Date(pickerState.monthCursor.getFullYear(),pickerState.monthCursor.getMonth()+1,1); renderDatePicker(); }; if($('calendarDays')) $('calendarDays').onclick=(e)=>{ const btn=e.target.closest('[data-date-value]'); if(!btn) return; pickerState.tempDate=btn.dataset.dateValue; renderDatePicker(); }; if($('pickTodayDate')) $('pickTodayDate').onclick=()=>{ pickerState.tempDate=today(); pickerState.monthCursor=monthStartDate(today()); renderDatePicker(); }; if($('clearSelectedDate')) $('clearSelectedDate').onclick=()=>{ pickerState.tempDate=''; if(pickerState.dateTarget) $(pickerState.dateTarget).value=''; closeDatePicker(); }; if($('applyDateSelection')) $('applyDateSelection').onclick=()=>{ if(pickerState.dateTarget && pickerState.tempDate) setInputDateValue(pickerState.dateTarget,pickerState.tempDate); closeDatePicker(); }; if($('datePickerModal')) $('datePickerModal').addEventListener('click',e=>{ if(e.target.id==='datePickerModal') closeDatePicker(); }); if($('openSchedulePicker')) $('openSchedulePicker').onclick=()=>openScheduleModal(); if($('closeScheduleModal')) $('closeScheduleModal').onclick=closeScheduleModal; if($('cancelScheduleModal')) $('cancelScheduleModal').onclick=closeScheduleModal; if($('addScheduleRowBtn')) $('addScheduleRowBtn').onclick=()=>{ const {day,start,end}=pickerState.schedule; if(!day||!start||!end) return alert('Əvvəl gün, başlama saatı və bitmə saatını seçin.'); if(end<=start) return alert('Bitmə saatı başlama saatından sonra olmalıdır.'); const ix=pickerState.scheduleItems.findIndex(x=>x.day===day); if(ix>=0) pickerState.scheduleItems[ix]={day,start,end}; else pickerState.scheduleItems.push({day,start,end}); pickerState.schedule={day:'',start:'',end:''}; renderExternalScheduleRows(pickerState.scheduleItems); initSchedulePicker(); };  if($('scheduleModal')) $('scheduleModal').addEventListener('click',(e)=>{ if(e.target.id==='scheduleModal') closeScheduleModal(); }); if($('scheduleDayChips')) $('scheduleDayChips').onclick=(e)=>{ const b=e.target.closest('[data-sched-day]'); if(!b) return; pickerState.schedule.day=b.dataset.schedDay; initSchedulePicker(); }; if($('scheduleStartWheel')) $('scheduleStartWheel').onclick=(e)=>{ const b=e.target.closest('[data-sched-start]'); if(!b) return; pickerState.schedule.start=b.dataset.schedStart; initSchedulePicker(); b.scrollIntoView({block:'center',behavior:'smooth'}); }; if($('scheduleEndWheel')) $('scheduleEndWheel').onclick=(e)=>{ const b=e.target.closest('[data-sched-end]'); if(!b) return; pickerState.schedule.end=b.dataset.schedEnd; initSchedulePicker(); b.scrollIntoView({block:'center',behavior:'smooth'}); }; if($('modalScheduleList')) $('modalScheduleList').onclick=(e)=>{ const b=e.target.closest('[data-remove-schedule]'); if(!b) return; pickerState.scheduleItems.splice(Number(b.dataset.removeSchedule),1); initSchedulePicker(); }; initSchedulePicker(); initSupabase();refreshIcons();
});
