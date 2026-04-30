let data={groups:[],students:[],payments:[]};
let auth=null;
let db=null;
let currentUser=null;
let isHydrating=true;
let saveTimer=null;
let unsubscribeAuth=null;
const $=id=>document.getElementById(id);
const days=['Bazar ertəsi','Çərşənbə axşamı','Çərşənbə','Cümə axşamı','Cümə','Şənbə','Bazar'];
const months=['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];

function id(){return crypto.randomUUID?crypto.randomUUID():Date.now()+Math.random().toString(16)}
function isSupabaseConfigured(){
  const cfg=window.HAZIRLIQ_SUPABASE_CONFIG;
  return !!(cfg && cfg.url && cfg.anonKey && !String(cfg.url).includes('PASTE_') && !String(cfg.anonKey).includes('PASTE_'));
}
function normalizeData(cloudData){
  return {
    groups:Array.isArray(cloudData?.groups)?cloudData.groups:[],
    students:Array.isArray(cloudData?.students)?cloudData.students:[],
    payments:Array.isArray(cloudData?.payments)?cloudData.payments:[]
  };
}
async function saveNow(){
  if(!db || !currentUser || isHydrating) return false;
  try{
    if($('cloudStatus')) $('cloudStatus').textContent='Cloud yazılır...';
    const {error}=await db
      .from('user_states')
      .upsert({user_id:currentUser.id,data,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error) throw error;
    if($('cloudStatus')) $('cloudStatus').textContent='Cloud saxlandı';
    return true;
  }catch(err){
    console.error(err);
    if($('cloudStatus')) $('cloudStatus').textContent='Cloud xətası';
    toast('Supabase yaddaşa yazmaq alınmadı: '+(err?.message||''));
    return false;
  }
}
function save(){
  if(!db || !currentUser || isHydrating) return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>saveNow(),250);
}
async function loadCloudData(){
  isHydrating=true;
  try{
    const {data:row,error}=await db
      .from('user_states')
      .select('data')
      .eq('user_id',currentUser.id)
      .maybeSingle();
    if(error) throw error;
    if(row?.data){
      data=normalizeData(row.data);
    }else{
      data={groups:[],students:[],payments:[]};
      const {error:insertError}=await db
        .from('user_states')
        .insert({user_id:currentUser.id,data});
      if(insertError) throw insertError;
    }
    if($('cloudStatus')) $('cloudStatus').textContent='Cloud aktivdir';
  }catch(err){
    console.error(err);
    toast('Supabase məlumatları yüklənmədi');
  }finally{
    isHydrating=false;
    $('appShell')?.classList.remove('locked');
    $('authScreen')?.classList.add('locked');
    renderAll();
  }
}
function setAuthMessage(text,ok=false){
  const box=$('authMessage');
  if(!box) return;
  box.textContent=text||'';
  box.classList.toggle('ok',!!ok);
}
function supabaseErrorMessage(err){
  const msg=String(err?.message||'').toLowerCase();
  if(msg.includes('invalid login credentials')) return 'Email və ya şifrə yanlışdır.';
  if(msg.includes('already registered') || msg.includes('user already registered')) return 'Bu email ilə hesab artıq var.';
  if(msg.includes('password')) return 'Şifrə minimum 6 simvol olmalıdır.';
  if(msg.includes('email not confirmed')) return 'Email təsdiqlənməyib. Supabase-də email confirmation-u söndürün və ya emaili təsdiqləyin.';
  if(msg.includes('failed to fetch') || msg.includes('network')) return 'İnternet bağlantısını yoxlayın.';
  return err?.message||'Supabase xətası baş verdi.';
}
async function initSupabase(){
  if(!isSupabaseConfigured()){
    $('appShell')?.classList.add('locked');
    $('authScreen')?.classList.remove('locked');
    setAuthMessage('Supabase config hələ yazılmayıb. supabase-config.js faylını doldurun.');
    return;
  }
  db=window.supabase.createClient(window.HAZIRLIQ_SUPABASE_CONFIG.url, window.HAZIRLIQ_SUPABASE_CONFIG.anonKey);
  auth=db.auth;

  const {data:sessionData}=await auth.getSession();
  currentUser=sessionData?.session?.user||null;
  if(currentUser){
    await loadCloudData();
  }else{
    isHydrating=true;
    data={groups:[],students:[],payments:[]};
    $('appShell')?.classList.add('locked');
    $('authScreen')?.classList.remove('locked');
  }

  const {data:listener}=auth.onAuthStateChange(async(event,session)=>{
    currentUser=session?.user||null;
    if(currentUser){
      setAuthMessage('Uğurla daxil oldunuz.',true);
      await loadCloudData();
    }else{
      isHydrating=true;
      data={groups:[],students:[],payments:[]};
      $('appShell')?.classList.add('locked');
      $('authScreen')?.classList.remove('locked');
    }
    refreshIcons();
  });
  unsubscribeAuth=listener?.subscription;
  refreshIcons();
}
function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function money(n){return Number(n||0).toFixed(0)+' AZN'}
function today(){return new Date().toISOString().slice(0,10)}
function curMonth(){return new Date().toISOString().slice(0,7)}
function active(){return data.students.filter(s=>s.status==='active')}
function group(id){return data.groups.find(g=>g.id===id)}
function student(id){return data.students.find(s=>s.id===id)}
function monthName(m){if(!m)return'-';let [y,mo]=m.split('-');return months[+mo-1]+' '+y}
function dateAz(d){return d?new Date(d).toLocaleDateString('az-AZ'):'-'}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1800)}
function cleanDate(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
function addMonths(date,count){const d=new Date(date);const originalDay=d.getDate();d.setMonth(d.getMonth()+count);if(d.getDate()!==originalDay)d.setDate(0);return d;}
function timeToMinutes(t){if(!t)return 0;const [h,m]=String(t).split(':').map(Number);return (h||0)*60+(m||0)}
function durationMinutes(start,end){return Math.max(timeToMinutes(end)-timeToMinutes(start),0)}
function durationText(start,end){const mins=durationMinutes(start,end);const h=Math.floor(mins/60);const m=mins%60;if(h&&m)return `${h} saat ${m} dəq`;if(h)return `${h} saat`;return `${m} dəq`;}
function todayDayName(){return days[(new Date().getDay()+6)%7]}
function totalHoursText(minutes){const h=Math.floor(minutes/60);const m=minutes%60;if(h&&m)return `${h} saat ${m} dəq`;if(h)return `${h} saat`;return `${m} dəq`;}

/*
Correct payment logic:
- Registration day is free/not debt.
- First charge is after 1 month from join date.
- Every next monthly anniversary creates one more charge.
- Debt = overdue charges - all paid.
- Expected = debt + next upcoming monthly charge, then minus paid amount already covering it.
- Payments are treated as money credit. Partial payments reduce remaining amount.
*/
function studentFinance(s, referenceDate=new Date()){
  const fee=Number(s.fee||0);
  const now=cleanDate(referenceDate);
  const join=cleanDate(s.joinDate);

  if(!s.joinDate || fee<=0){
    return {fee, paid:0, overdueCharges:0, expectedCharges:0, debt:0, expected:0, nextDue:addMonths(new Date(),1), overdueCount:0, nextCovered:false};
  }

  let paidTotal=data.payments
    .filter(p=>p.studentId===s.id)
    .reduce((a,p)=>a+Number(p.amount||0),0);

  let overdueCount=0;
  let due=addMonths(join,1);

  while(cleanDate(due)<=now){
    overdueCount++;
    due=addMonths(join,overdueCount+1);
  }

  const nextDue=due;
  const overdueCharges=overdueCount*fee;
  const expectedCharges=overdueCharges+fee;

  const debt=Math.max(overdueCharges-paidTotal,0);
  const expected=Math.max(expectedCharges-paidTotal,0);
  const nextCovered=paidTotal>=expectedCharges;

  return {fee, paid:paidTotal, overdueCharges, expectedCharges, debt, expected, nextDue, overdueCount, nextCovered};
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
  if(f.debt>0)return '<span class="badge late">Keçmiş borclu</span>';
  if(f.expected>0)return '<span class="badge wait">Gözlənilir</span>';
  return '<span class="badge paid">Ödənib</span>';
}
function methodHtml(method){
  const icon = method==='cash' ? 'wallet' : 'credit-card';
  const label = method==='cash' ? 'Nəğd' : 'Kart';
  return `<span class="methodTag"><i data-lucide="${icon}"></i><span>${label}</span></span>`;
}
function refreshIcons(){if(window.lucide&&typeof window.lucide.createIcons==='function'){window.lucide.createIcons();}}
function timeOptions(sel='15:00'){
  let out='';
  for(let h=7;h<=22;h++)for(let m of [0,30]){
    let v=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
    out+=`<option ${v===sel?'selected':''}>${v}</option>`;
  }
  return out;
}
function addSchedule(day=days[0],start='15:00',end='17:00'){
  let div=document.createElement('div');
  div.className='scheduleRow';
  div.innerHTML=`<select class="schDay">${days.map(d=>`<option ${d===day?'selected':''}>${d}</option>`).join('')}</select><select class="schStart">${timeOptions(start)}</select><select class="schEnd">${timeOptions(end)}</select><button type="button" class="mini red">X</button>`;
  div.querySelector('button').onclick=()=>div.remove();
  $('scheduleRows').appendChild(div);
}
function getSchedule(){
  return [...document.querySelectorAll('.scheduleRow')].map(r=>({day:r.querySelector('.schDay').value,start:r.querySelector('.schStart').value,end:r.querySelector('.schEnd').value}));
}
function scheduleText(g){return (g.schedule||[]).map(s=>`${s.day}: ${s.start}-${s.end}`).join(', ')||'Dərs günü yoxdur'}
function table(head,rows,empty='Məlumat yoxdur'){
  if(!rows.length)return `<div class="empty">${empty}</div>`;
  return `<div class="tableWrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function acc(id,title,sub,pills,body,open=false){
  return `<div class="accordion ${open?'open':''}" id="${id}"><button class="accHead" onclick="toggle('${id}')"><div><b>${title}</b><br><span>${sub}</span></div><div class="pills">${pills.map(p=>`<span class="pill">${p}</span>`).join('')}</div></button><div class="accBody">${body}</div></div>`
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
  $('studentGroup').innerHTML=gs||'<option value="">Əvvəl qrup yaradın</option>';
  const currentReport = $('reportGroup')?.value || 'all';
  $('reportGroup').innerHTML='<option value="all">Bütün qruplar</option>'+gs;
  if ([...$('reportGroup').options].some(o=>o.value===currentReport)) $('reportGroup').value = currentReport;
  $('paymentStudent').innerHTML=active().map(s=>{
    const f=studentFinance(s);
    return `<option value="${s.id}">${esc(s.name)} — ${esc(group(s.groupId)?.name||'Qrupsuz')} — Alınmalı: ${money(f.expected)}</option>`;
  }).join('')||'<option value="">Aktiv şagird yoxdur</option>';
}

function renderHome(){
  $('stActive').textContent=active().length;
  $('stMonthlyMax').textContent=money(monthlyMaximum());
  $('stPaid').textContent=money(paidThisMonth());
  $('stExpected').textContent=money(totalExpected());
  $('stDebt').textContent=money(totalDebt());
  $('stCash').textContent=money(paidThisMonth('cash'));
  $('stCard').textContent=money(paidThisMonth('card'));
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
      [`Aylıq maksimum: ${money(monthlyMaximum(g.id))}`,`Alınmalı: ${money(totalExpected(g.id))}`,`Keçmiş borc: ${money(totalDebt(g.id))}`],
      table(['Şagird','Növbəti ödəniş','Aylıq','Ödənilib','Alınmalı','Keçmiş borc','Status'],rows,'Bu qrupda məlumat yoxdur.'),
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
        <td>${dateAz(addMonths(cleanDate(s.joinDate),1))}</td>
        <td>${dateAz(f.nextDue)}</td>
        <td>${money(f.expected)}</td>
        <td>${money(f.debt)}</td>
        <td>${s.status==='active'?'Aktiv':'Çıxıb'}</td>
        <td><button class="mini" onclick="editStudent('${s.id}')">Dəyiş</button> <button class="mini red" onclick="deleteStudent('${s.id}')">Sil</button></td>
      </tr>`;
    });
    return acc('sg'+g.id,esc(g.name),ss.length+' şagird',[`Aylıq maksimum: ${money(monthlyMaximum(g.id))}`,`Alınmalı: ${money(totalExpected(g.id))}`,`Keçmiş borc: ${money(totalDebt(g.id))}`],table(['Şagird','Aylıq','İlk ödəniş','Növbəti ödəniş','Alınmalı','Keçmiş borc','Status','Əməliyyat'],rows,'Bu qrupda şagird yoxdur.'),i===0)
  }).join('');
  $('studentList').innerHTML=html||'<div class="empty">Qrup yoxdur.</div>';
}

function addQuickPayment(studentId, amountInputId){
  const s = student(studentId);
  if(!s) return alert('Şagird tapılmadı.');
  const input = $(amountInputId);
  const amount = Number(input.value || 0);
  if(amount <= 0) return alert('Məbləği düzgün yazın.');
  data.payments.push({id:id(),studentId:studentId,amount:amount,date:$('quickPaymentDate').value || today(),method:$('quickPaymentMethod').value,note:''});
  input.value = '';
  persistAndRender('Ödəniş yadda saxlandı');
}

function fillQuickAmount(studentId, inputId, type){
  const s = student(studentId);
  if(!s) return;
  const f = studentFinance(s);
  const input = $(inputId);
  if(type === 'monthly') input.value = Number(s.fee || 0);
  if(type === 'expected') input.value = Number(f.expected || 0);
  if(type === 'debt') input.value = Number(f.debt || 0);
}

function renderQuickPaymentGroups(){
  const box = $('quickPaymentGroups');
  if(!box) return;
  const search = ($('paymentSearch')?.value || '').toLowerCase().trim();
  if(!data.groups.length){box.innerHTML = '<div class="empty">Hələ qrup yoxdur.</div>';return;}
  box.innerHTML = data.groups.map((g,i)=>{
    let ss = active().filter(s=>s.groupId===g.id).filter(s=>!search || s.name.toLowerCase().includes(search));
    let rows = ss.map(s=>{
      const f = studentFinance(s);
      const inputId = 'payinp_' + s.id.replaceAll('-', '_');
      return `<tr>
        <td><b>${esc(s.name)}</b><br><span class="muted">${esc(s.phone||'')}</span></td>
        <td>${money(s.fee)}</td>
        <td>${money(f.paid)}</td>
        <td>${money(f.expected)}</td>
        <td>${money(f.debt)}</td>
        <td>${studentStatusHtml(s)}</td>
        <td>
          <div class="payBox">
            <div class="payMainLine">
              <input id="${inputId}" type="number" min="0" placeholder="Məbləğ yaz">
              <button class="savePayBtn" type="button" onclick="addQuickPayment('${s.id}','${inputId}')">Ödənişi yadda saxla</button>
            </div>
            <div class="payHelperText">Hazır məbləğ seç:</div>
            <div class="presetBtns">
              <button class="presetBtn" type="button" onclick="fillQuickAmount('${s.id}','${inputId}','monthly')">${money(s.fee)} yaz</button>
              <button class="presetBtn" type="button" onclick="fillQuickAmount('${s.id}','${inputId}','expected')">Alınmalı məbləği yaz</button>
              <button class="presetBtn debtPreset" type="button" onclick="fillQuickAmount('${s.id}','${inputId}','debt')">Keçmiş borcu yaz</button>
            </div>
          </div>
        </td>
      </tr>`;
    });
    return acc('quickpay'+g.id,esc(g.name),scheduleText(g),[`Aylıq maksimum: ${money(monthlyMaximum(g.id))}`,`Alınmalı: ${money(totalExpected(g.id))}`,`Keçmiş borc: ${money(totalDebt(g.id))}`],table(['Şagird','Aylıq','Ödənilib','Alınmalı','Keçmiş borc','Status','Ödəniş əlavə et'],rows,'Bu qrupda şagird yoxdur.'),i===0);
  }).join('');
}

function renderPayments(){
  $('paymentList').innerHTML=data.groups.map((g,i)=>{
    let ps=data.payments.filter(p=>student(p.studentId)?.groupId===g.id);
    let rows=ps.sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<tr><td>${esc(student(p.studentId)?.name||'Silinmiş')}</td><td>${money(p.amount)}</td><td>${dateAz(p.date)}</td><td>${methodHtml(p.method)}</td><td><button class="mini red" onclick="deletePayment('${p.id}')">Sil</button></td></tr>`);
    return acc('pay'+g.id,esc(g.name),ps.length+' ödəniş',[`Toplam ödənilib: ${money(ps.reduce((a,p)=>a+Number(p.amount||0),0))}`,`Alınmalı: ${money(totalExpected(g.id))}`],table(['Şagird','Məbləğ','Tarix','Forma',''],rows,'Ödəniş yoxdur.'),i===0)
  }).join('');
}
function renderDebtors(){$('debtorList').innerHTML=groupAccordions(true);}
function renderReport(){
  const gid = $('reportGroup') ? ($('reportGroup').value || 'all') : 'all';
  const selectedGroups = gid === 'all' ? data.groups : data.groups.filter(g => g.id === gid);
  const selectedIds = selectedGroups.map(g => g.id);
  const selectedStudents = active().filter(s => selectedIds.includes(s.groupId));
  const expectedSum = selectedStudents.reduce((a,s)=>a + studentFinance(s).expected, 0);
  const debtSum = selectedStudents.reduce((a,s)=>a + studentFinance(s).debt, 0);
  const selectedPayments = data.payments.filter(p => {const st = student(p.studentId);return st && selectedIds.includes(st.groupId);});
  const paidSum = selectedPayments.reduce((a,p)=>a + Number(p.amount || 0), 0);
  const cashSum = selectedPayments.filter(p=>p.method==='cash').reduce((a,p)=>a + Number(p.amount || 0), 0);
  const cardSum = selectedPayments.filter(p=>p.method==='card').reduce((a,p)=>a + Number(p.amount || 0), 0);
  $('rpExpected').textContent = money(expectedSum);
  $('rpPaid').textContent = money(paidSum);
  $('rpDebt').textContent = money(debtSum);
  $('rpCashCard').textContent = money(cashSum) + ' / ' + money(cardSum);
  $('reportList').innerHTML = selectedGroups.map((g,i)=>{
    const ss = active().filter(s => s.groupId === g.id);
    const rows = ss.map(s=>{
      const f = studentFinance(s);
      return `<tr>
        <td>${esc(s.name)}</td>
        <td>${money(s.fee)}</td>
        <td>${dateAz(f.nextDue)}</td>
        <td>${money(f.paid)}</td>
        <td>${money(f.expected)}</td>
        <td>${money(f.debt)}</td>
        <td>${studentStatusHtml(s)}</td>
      </tr>`;
    });
    return acc('rep'+g.id,esc(g.name),'Ümumi hesabat',[`Aylıq maksimum: ${money(monthlyMaximum(g.id))}`,`Alınmalı: ${money(totalExpected(g.id))}`,`Keçmiş borc: ${money(totalDebt(g.id))}`],table(['Şagird','Aylıq','Növbəti ödəniş','Ödənilib','Alınmalı','Keçmiş borc','Status'], rows, 'Bu qrupda şagird yoxdur.'),i===0)
  }).join('');
}

function renderAll(){
  fillSelects();
  renderHome();
  renderGroups();
  renderSchedule();
  renderStudents();
  renderQuickPaymentGroups();
  renderPayments();
  renderDebtors();
  renderReport();
  refreshIcons();
}

async function persistAndRender(message){
  renderAll();
  const ok=await saveNow();
  if(message) toast(ok?message:'Yaddaşa yazılmadı. Console-u yoxlayın.');
}

window.editGroup=id=>{let g=group(id); if(!g)return;$('groupId').value=g.id;$('groupName').value=g.name;$('groupNote').value=g.note||'';$('scheduleRows').innerHTML='';(g.schedule||[]).forEach(s=>addSchedule(s.day,s.start,s.end));openPage('groups')}
window.deleteGroup=id=>{if(data.students.some(s=>s.groupId===id))return alert('Bu qrupda şagird var. Əvvəl şagirdləri silin və ya başqa qrupa keçirin.'); if(confirm('Qrup silinsin?')){data.groups=data.groups.filter(g=>g.id!==id);persistAndRender('Qrup silindi')}}
window.editStudent=id=>{let s=student(id); if(!s)return;$('studentId').value=s.id;$('studentName').value=s.name;$('studentPhone').value=s.phone||'';$('parentPhone').value=s.parent||'';$('studentGroup').value=s.groupId;$('joinDate').value=s.joinDate;$('monthlyFee').value=s.fee;$('studentStatus').value=s.status;openPage('students')}
window.deleteStudent=id=>{if(confirm('Şagird silinsin?')){data.students=data.students.filter(s=>s.id!==id);persistAndRender('Şagird silindi')}}
window.deletePayment=id=>{if(confirm('Ödəniş silinsin?')){data.payments=data.payments.filter(p=>p.id!==id);persistAndRender('Ödəniş silindi')}}

function pageMeta(p){
  return {
    home:['Ana səhifə','Bu ay üçün alınmalı məbləğ, ödənişlər və ümumi görünüş.'],
    groups:['Qruplar','Hər qrup üçün dərs günləri və saatları rahat idarə olunur.'],
    schedule:['Cədvəl','Həftəlik dərs planını günlər üzrə aydın və rahat görün.'],
    students:['Şagirdlər','Şagirdləri qrup-qrupla izləyin və idarə edin.'],
    payments:['Ödənişlər','Ödənişləri qrup və şagird üzrə sürətli şəkildə əlavə edin.'],
    debtors:['Keçmiş borclar','Vaxtı keçmiş ödənişləri ayrıca görün.'],
    reports:['Hesabat','Seçilən qrupa görə əsas göstəricilər avtomatik yenilənir.'],
    info:['Məlumat','Sistemin işləmə qaydası və faydalı seçimlər.']
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
  // v11: Mobile drawer removed completely. Navigation is now direct single-tap.
  document.addEventListener('click',(e)=>{
    const btn=e.target.closest('.nav[data-page], .bottomTab[data-page]');
    if(!btn) return;
    e.preventDefault();
    openPage(btn.dataset.page);
  });

  $('authForm').onsubmit=async(e)=>{
    e.preventDefault();
    if(!auth) return setAuthMessage('Supabase config tamamlanmayıb.');
    try{
      setAuthMessage('Daxil olunur...',true);
      const {error}=await auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});
      if(error) throw error;
    }catch(err){setAuthMessage(supabaseErrorMessage(err));}
  };
  $('registerBtn').onclick=async()=>{
    if(!auth) return setAuthMessage('Supabase config tamamlanmayıb.');
    try{
      setAuthMessage('Hesab yaradılır...',true);
      const {data:signupData,error}=await auth.signUp({email:$('authEmail').value.trim(),password:$('authPassword').value});
      if(error) throw error;
      if(signupData?.user && !signupData?.session){
        setAuthMessage('Hesab yaradıldı. Email təsdiqi aktivdirsə, emailinizi təsdiqləyin və sonra daxil olun.',true);
      }
    }catch(err){setAuthMessage(supabaseErrorMessage(err));}
  };
  $('logoutBtn').onclick=()=>auth?.signOut();
  $('addSchedule').onclick=()=>addSchedule();
  $('paymentSearch').oninput=renderQuickPaymentGroups;
  $('reportGroup').onchange=()=>renderReport();
  $('quickPaymentDate').value=today();
  $('quickPaymentMethod').onchange=renderQuickPaymentGroups;
  $('quickPaymentDate').onchange=renderQuickPaymentGroups;
  $('clearGroup').onclick=()=>{$('groupForm').reset();$('groupId').value='';$('scheduleRows').innerHTML='';addSchedule()};
  $('clearStudent').onclick=()=>{$('studentForm').reset();$('studentId').value='';$('joinDate').value=today()};
  $('studentSearch').oninput=renderStudents;
  $('groupForm').onsubmit=e=>{
    e.preventDefault();
    let sched=getSchedule();
    if(!sched.length)return alert('Ən azı bir dərs günü seçin.');
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
    let s={id:sid,name:$('studentName').value.trim(),phone:$('studentPhone').value.trim(),parent:$('parentPhone').value.trim(),groupId:$('studentGroup').value,joinDate:$('joinDate').value,fee:Number($('monthlyFee').value),status:$('studentStatus').value};
    let i=data.students.findIndex(x=>x.id===sid); i>=0?data.students[i]=s:data.students.push(s);
    $('clearStudent').click();persistAndRender('Şagird yadda saxlandı');
  };
  $('paymentForm').onsubmit=e=>{
    e.preventDefault();
    let sid=$('paymentStudent').value;
    if(!sid)return alert('Şagird seçin.');
    data.payments.push({id:id(),studentId:sid,amount:Number($('paymentAmount').value),date:$('paymentDate').value,method:$('paymentMethod').value,note:$('paymentNote').value.trim()});
    $('paymentForm').reset();$('paymentDate').value=today();persistAndRender('Ödəniş yazıldı');
  };
  $('exportData').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='hazirliq-melumatlari.json';a.click();};
  $('clearAll').onclick=()=>{if(confirm('Bütün məlumatlar silinsin?')){data={groups:[],students:[],payments:[]};persistAndRender('Bütün məlumatlar silindi')}};
  $('joinDate').value=today();$('paymentDate').value=today();addSchedule();initSupabase();refreshIcons();
});
