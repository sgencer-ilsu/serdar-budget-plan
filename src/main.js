
import './style.css'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  document.querySelector('#app').innerHTML = `<div class="auth-wrap"><div class="auth">
  <h1>Supabase ayarı eksik</h1><p class="muted">VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değişkenlerini ekleyin.</p></div></div>`
  throw new Error('Missing Supabase env vars')
}

const supabase = createClient(supabaseUrl, supabaseKey)
const TL = n => new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(Number(n||0))
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))

let session = null
let currentMonth = new Date().toISOString().slice(0,7)

supabase.auth.onAuthStateChange((_event, s)=>{ session=s; render() })
session = (await supabase.auth.getSession()).data.session
render()

function render(){
  if(!session) return renderAuth()
  renderApp()
}

function renderAuth(){
  document.querySelector('#app').innerHTML = `
  <div class="auth-wrap"><div class="auth">
    <h1>Serdar Bütçe Planı</h1>
    <p class="muted">Bütçe verilerine erişmek için giriş yap.</p>
    <form id="loginForm">
      <input name="email" type="email" placeholder="E-posta" required>
      <input name="password" type="password" placeholder="Şifre" minlength="6" required>
      <button class="btn" type="submit">Giriş Yap</button>
      <button class="btn secondary" type="button" id="signup">İlk kez kullanıyorum · Hesap oluştur</button>
    </form><div id="authMsg"></div>
  </div></div>`
  document.querySelector('#loginForm').onsubmit = login
  document.querySelector('#signup').onclick = signup
}

async function login(e){
  e.preventDefault()
  const f = new FormData(e.currentTarget)
  const {error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')})
  document.querySelector('#authMsg').innerHTML = error?`<div class="msg">${esc(error.message)}</div>`:''
}

async function signup(){
  const form=document.querySelector('#loginForm')
  const f=new FormData(form)
  const email=f.get('email'), password=f.get('password')
  if(!email || !password) return document.querySelector('#authMsg').innerHTML='<div class="msg">Önce e-posta ve şifre gir.</div>'
  const {error}=await supabase.auth.signUp({email,password})
  document.querySelector('#authMsg').innerHTML = `<div class="msg">${error?esc(error.message):'Hesap oluşturuldu. E-posta doğrulaması açıksa gelen bağlantıyı onayla.'}</div>`
}

function renderApp(){
  document.querySelector('#app').innerHTML = `
  <main class="shell">
    <header class="top">
      <div><h1>Serdar Bütçe Planı</h1><p class="muted">Tüm cihazlarda aynı veritabanı</p></div>
      <div class="actions">
        <input class="month" id="month" type="month" value="${currentMonth}">
        <button class="btn secondary" id="logout">Çıkış</button>
      </div>
    </header>
    <div id="seedBox"></div>
    <section class="summary" id="summary"></section>
    <div class="grid">
      <section class="panel"><h2>Gelirler</h2><div id="incomes"></div></section>
      <section class="panel"><h2>Kredi Kartları</h2><div id="cards"></div></section>
    </div>
    <div class="grid">
      <section class="panel"><h2>Nakit Avanslar</h2><div id="advances"></div></section>
      <section class="panel"><h2>Sabit Giderler</h2><div id="fixed"></div></section>
    </div>
    <section class="panel"><h2>Harcama Ekle</h2>
      <form id="expenseForm" class="form">
        <input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}">
        <select name="category">
          <option>Market</option><option>Cafe/Restaurant</option><option>İlsu_Özel_Ders</option><option>İlsu_Spor_Takım</option>
          <option>Faturalar</option><option>Apps</option><option>Sağlık</option><option>Shila(Pet)</option><option>Tatil</option><option>Arabalarım</option>
        </select>
        <input name="description" placeholder="Açıklama">
        <input name="amount" type="number" step=".01" inputmode="decimal" placeholder="Tutar" required>
        <select name="method"><option>Nakit</option><option>Garanti KK</option><option>Denizbank KK</option></select>
        <button class="btn">Ekle</button>
      </form>
      <div id="expenses"></div>
    </section>
  </main>`
  document.querySelector('#month').onchange=e=>{currentMonth=e.target.value;load()}
  document.querySelector('#logout').onclick=()=>supabase.auth.signOut()
  document.querySelector('#expenseForm').onsubmit=addExpense
  load()
}

async function load(){
  const uid=session.user.id
  const [incR,cardsR,monthsR,fixedR,advR,expR] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id',uid).eq('month',currentMonth).order('id'),
    supabase.from('cards').select('*').eq('user_id',uid).order('name'),
    supabase.from('card_months').select('*').eq('user_id',uid).eq('month',currentMonth),
    supabase.from('fixed_expenses').select('*').eq('user_id',uid).order('due_day'),
    supabase.from('cash_advances').select('*').eq('user_id',uid).eq('paid',false).order('due_date'),
    supabase.from('expenses').select('*').eq('user_id',uid).gte('expense_date',currentMonth+'-01').lt('expense_date',nextMonth(currentMonth)+'-01').order('expense_date',{ascending:false})
  ])
  const err=[incR,cardsR,monthsR,fixedR,advR,expR].find(x=>x.error)?.error
  if(err){ alert(err.message); return }

  const incomesData=incR.data||[], cardsData=cardsR.data||[], months=monthsR.data||[], fixedData=fixedR.data||[], adv=advR.data||[], exps=expR.data||[]
  const cardRows=cardsData.map(c=>({...c,...(months.find(m=>m.card_id===c.id)||{current_spend:0,carried:0,interest:0,paid_amount:0,month:currentMonth})}))

  const incomeTotal=incomesData.reduce((s,x)=>s+Number(x.amount),0)
  const cardTotal=cardRows.reduce((s,x)=>s+Number(x.current_spend)+Number(x.carried)+Number(x.interest)-Number(x.paid_amount),0)
  const advTotal=adv.reduce((s,x)=>s+Number(x.remaining_amount),0)

  document.querySelector('#summary').innerHTML = `
    <div class="sum"><small>Gelir</small><strong>${TL(incomeTotal)}</strong></div>
    <div class="sum"><small>Kart Borçları</small><strong>${TL(cardTotal)}</strong></div>
    <div class="sum"><small>Nakit Avans</small><strong>${TL(advTotal)}</strong></div>`
  document.querySelector('#incomes').innerHTML = incomesData.map(x=>`<div class="row"><span>${esc(x.name)}</span><b>${TL(x.amount)}</b></div>`).join('') || '<div class="empty">Bu ay gelir yok.</div>'
  document.querySelector('#cards').innerHTML = cardRows.map(x=>{
    const total=Number(x.current_spend)+Number(x.carried)+Number(x.interest)-Number(x.paid_amount)
    const monthId=x.id && x.card_id ? x.id : ''
    return `<div class="card"><div class="cardhead"><span>${esc(x.name)}</span><span>${TL(total)}</span></div>
      <div class="three">
        <div class="metric"><small>Dönem İçi</small>${TL(x.current_spend)}</div>
        <div class="metric"><small>Devreden</small>${TL(x.carried)}</div>
        <div class="metric"><small>Faiz</small>${TL(x.interest)}</div>
      </div>
      <div class="total">Bu ay toplam kart borcu: ${TL(total)}</div>
      ${monthId?`<div class="pay"><input id="p${monthId}" type="number" step=".01" inputmode="decimal" placeholder="Tutar gir">
      <button class="btn" data-pay-card="${monthId}">Ödeme Yap</button></div>`:'<div class="empty">Bu ay için kart dönemi kaydı yok.</div>'}
    </div>`
  }).join('')
  document.querySelectorAll('[data-pay-card]').forEach(b=>b.onclick=()=>payCard(b.dataset.payCard))

  document.querySelector('#advances').innerHTML = adv.map(x=>`<div class="card"><div class="cardhead"><span>${esc(x.bank)} · ${esc(x.description||'Nakit avans')}</span><span>${TL(x.remaining_amount)}</span></div>
    <small>Vade: ${esc(x.due_date||'—')}</small>
    <div class="pay"><input id="a${x.id}" type="number" step=".01" inputmode="decimal" placeholder="Tutar gir">
    <button class="btn" data-pay-advance="${x.id}">Ödeme Yap</button></div></div>`).join('') || '<div class="empty">Aktif nakit avans yok.</div>'
  document.querySelectorAll('[data-pay-advance]').forEach(b=>b.onclick=()=>payAdvance(b.dataset.payAdvance))

  document.querySelector('#fixed').innerHTML = fixedData.map(x=>`<div class="row"><span>${esc(x.name)} · ayın ${x.due_day}'sı</span><b>${TL(x.amount)}</b></div>`).join('') || '<div class="empty">Sabit gider yok.</div>'
  document.querySelector('#expenses').innerHTML = exps.map(x=>`<div class="row"><span>${esc(x.expense_date)} · ${esc(x.category)} · ${esc(x.description||'')}</span><b>${TL(x.amount)}</b></div>`).join('')

  const anyData = incomesData.length || cardsData.length || fixedData.length || adv.length
  document.querySelector('#seedBox').innerHTML = anyData ? '' : `<div class="seed">
    <b>İlk kurulum</b><p class="muted">Önceki bütçe planındaki bilinen başlangıç verilerini bu hesaba ekleyebilirsin.</p>
    <button class="btn" id="seedBtn">Başlangıç verilerini yükle</button></div>`
  if(!anyData) document.querySelector('#seedBtn').onclick=seedData
}

async function payCard(cardMonthId){
  const el=document.querySelector('#p'+cardMonthId), amount=Number(el.value)
  if(!amount || amount<=0) return alert('Ödeme tutarını gir.')
  const {data:row,error:e1}=await supabase.from('card_months').select('paid_amount').eq('id',cardMonthId).single()
  if(e1)return alert(e1.message)
  const {error}=await supabase.from('card_months').update({paid_amount:Number(row.paid_amount)+amount}).eq('id',cardMonthId)
  if(error)return alert(error.message)
  await supabase.from('payments').insert({user_id:session.user.id,payment_date:new Date().toISOString().slice(0,10),kind:'card',target_id:cardMonthId,amount})
  load()
}

async function payAdvance(id){
  const el=document.querySelector('#a'+id), amount=Number(el.value)
  if(!amount || amount<=0) return alert('Ödeme tutarını gir.')
  const {data:row,error:e1}=await supabase.from('cash_advances').select('remaining_amount').eq('id',id).single()
  if(e1)return alert(e1.message)
  const remaining=Math.max(0,Number(row.remaining_amount)-amount)
  const {error}=await supabase.from('cash_advances').update({remaining_amount:remaining,paid:remaining<=0}).eq('id',id)
  if(error)return alert(error.message)
  await supabase.from('payments').insert({user_id:session.user.id,payment_date:new Date().toISOString().slice(0,10),kind:'advance',target_id:id,amount})
  load()
}

async function addExpense(e){
  e.preventDefault()
  const f=new FormData(e.currentTarget)
  const method=f.get('method')
  const {error}=await supabase.from('expenses').insert({
    user_id:session.user.id, expense_date:f.get('date'), category:f.get('category'),
    description:f.get('description'), amount:Number(f.get('amount')), payment_method:method,
    card_name:method.includes('Garanti')?'Garanti':method.includes('Denizbank')?'Denizbank':null, installments:1
  })
  if(error)return alert(error.message)
  e.currentTarget.reset(); load()
}

async function seedData(){
  const uid=session.user.id
  const {data:cards,error:e1}=await supabase.from('cards').insert([
    {user_id:uid,name:'Garanti',cutoff_day:28,due_day:7},
    {user_id:uid,name:'Denizbank',cutoff_day:null,due_day:20}
  ]).select()
  if(e1)return alert(e1.message)
  const byName=Object.fromEntries(cards.map(x=>[x.name,x.id]))

  const incomes=[
    {user_id:uid,month:'2026-09',name:'Maaş',amount:170000},
    {user_id:uid,month:'2026-09',name:'Özel Ders',amount:250000},
    {user_id:uid,month:'2026-09',name:'Kira',amount:69000}
  ]
  const cms=[
    ['Garanti','2026-09',230000,227000,0],['Garanti','2026-10',49000,0,0],['Garanti','2026-11',42000,0,0],['Garanti','2026-12',25000,0,0],['Garanti','2027-01',7918,0,0],
    ['Denizbank','2026-09',45000,41000,0],['Denizbank','2026-10',16000,0,0],['Denizbank','2026-11',15000,0,0],['Denizbank','2026-12',9000,0,0],['Denizbank','2027-01',9000,0,0],['Denizbank','2027-02',9000,0,0]
  ].map(x=>({user_id:uid,card_id:byName[x[0]],month:x[1],current_spend:x[2],carried:x[3],interest:x[4]}))
  const advances=[
    {user_id:uid,bank:'Finansbank',description:'Taksitli nakit avans',due_date:'2026-10-01',original_amount:50000,remaining_amount:50000},
    {user_id:uid,bank:'Finansbank',description:'Taksitli nakit avans',due_date:'2026-11-01',original_amount:50000,remaining_amount:50000},
    {user_id:uid,bank:'Finansbank',description:'Taksitli nakit avans',due_date:'2026-12-01',original_amount:50000,remaining_amount:50000}
  ]
  const results=await Promise.all([
    supabase.from('incomes').insert(incomes),
    supabase.from('fixed_expenses').insert({user_id:uid,name:'Sabit Giderler',amount:25000,due_day:6}),
    supabase.from('card_months').insert(cms),
    supabase.from('cash_advances').insert(advances)
  ])
  const err=results.find(r=>r.error)?.error
  if(err)return alert(err.message)
  load()
}

function nextMonth(m){
  const [y,mo]=m.split('-').map(Number)
  const d=new Date(Date.UTC(y,mo,1))
  return d.toISOString().slice(0,7)
}
