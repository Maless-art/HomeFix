const STORAGE_KEY = "homefix_data_v1"; // Compatible con versiones anteriores
const $ = (id) => document.getElementById(id);

const defaultData = {
  areas: [
    { id: crypto.randomUUID(), name: "Sala", icon: "🛋️" },
    { id: crypto.randomUUID(), name: "Cocina", icon: "🍳" },
    { id: crypto.randomUUID(), name: "Comedor", icon: "🍽️" },
    { id: crypto.randomUUID(), name: "Habitación principal", icon: "🛏️" },
    { id: crypto.randomUUID(), name: "Habitación Manuelito", icon: "🧸" },
    { id: crypto.randomUUID(), name: "Baño", icon: "🚿" },
    { id: crypto.randomUUID(), name: "Terraza", icon: "🌿" },
    { id: crypto.randomUUID(), name: "Patio", icon: "🌳" },
    { id: crypto.randomUUID(), name: "Lavandería", icon: "🧺" },
    { id: crypto.randomUUID(), name: "Garaje", icon: "🚗" }
  ],
  items: [],
  records: []
};

let data = normalizeData(loadData());
let route = { screen: "home", areaId: null, itemId: null };
let currentModal = null;
let itemFilter = "all";
let searchTerm = "";

const CATEGORIES = [
  { id:"Climatización", icon:"❄️", label:"Climatización" },
  { id:"Electricidad", icon:"⚡", label:"Electricidad" },
  { id:"Iluminación", icon:"💡", label:"Iluminación" },
  { id:"Plomería", icon:"🚰", label:"Plomería" },
  { id:"Construcción", icon:"🧱", label:"Construcción" },
  { id:"Acabados", icon:"🎨", label:"Acabados" },
  { id:"Mobiliario", icon:"🪑", label:"Mobiliario" },
  { id:"Línea Blanca", icon:"🏠", label:"Línea Blanca" },
  { id:"Electrónicos", icon:"📺", label:"Electrónicos" },
  { id:"Seguridad", icon:"🛡️", label:"Seguridad" },
  { id:"Exterior", icon:"🌳", label:"Exterior" }
];
function categoryIcon(cat){ return CATEGORIES.find(c=>c.id===cat)?.icon || "🔧"; }
function normalizeText(t){ return (t || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function isAirName(name){
  const n = normalizeText(name);
  return n === "aire acondicionado" || n.includes("aire acondicionado") || n === "split" || n.includes("mini split");
}
function isAir(item){ return isAirName(item?.name) || isAirName(item?.type); }
function normalizeData(raw){
  const d = raw || structuredClone(defaultData);
  d.areas = Array.isArray(d.areas) ? d.areas : [];
  d.items = Array.isArray(d.items) ? d.items : [];
  d.records = Array.isArray(d.records) ? d.records : [];
  d.items = d.items.map(i => {
    const item = { ...i };
    const air = isAir(item);
    if(air){
      item.maintenanceEnabled = true;
      if(![4,6].includes(Number(item.frequencyMonths))) item.frequencyMonths = 6;
    } else if(item.maintenanceEnabled === undefined){
      // Datos creados antes de esta versión: no generar alertas automáticas a artículos no-aires.
      item.maintenanceEnabled = Number(item.frequencyMonths || 0) > 0 ? false : false;
      item.frequencyMonths = 0;
    } else if(!item.maintenanceEnabled){
      item.frequencyMonths = 0;
    }
    return item;
  });
  return d;
}

function loadData(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(defaultData); }
  catch { return structuredClone(defaultData); }
}
function saveData(){ data = normalizeData(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); render(); }
function money(n){ return `$${Number(n || 0).toFixed(2)}`; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function monthKey(date){ return (date || "").slice(0,7); }
function yearKey(date){ return (date || "").slice(0,4); }
function addMonths(dateStr, months){
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0,10);
}
function daysUntil(dateStr){
  const a = new Date(`${todayISO()}T00:00:00`);
  const b = new Date(`${dateStr}T00:00:00`);
  return Math.ceil((b - a) / 86400000);
}
function fmtDate(dateStr){
  if(!dateStr) return "Sin fecha";
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-PA", { day:"2-digit", month:"short", year:"numeric" });
}
function areaName(id){ return data.areas.find(a=>a.id===id)?.name || "Sin área"; }
function areaIcon(id){ return data.areas.find(a=>a.id===id)?.icon || "🏠"; }
function areaTotal(areaId, filter = "all"){
  const itemIds = data.items.filter(i => i.areaId === areaId).map(i => i.id);
  return data.records.filter(r => itemIds.includes(r.itemId) && matchFilter(r.date, filter)).reduce((s,r)=>s+Number(r.amount||0),0);
}
function itemTotal(itemId){ return data.records.filter(r => r.itemId === itemId).reduce((s,r)=>s+Number(r.amount||0),0); }
function matchFilter(date, filter){
  const now = todayISO();
  if(filter === "month") return monthKey(date) === monthKey(now);
  if(filter === "year") return yearKey(date) === yearKey(now);
  return true;
}
function lastMaintenance(item){
  return data.records
    .filter(r => r.itemId === item.id && ["Mantenimiento","Instalación"].includes(r.type))
    .sort((a,b)=>b.date.localeCompare(a.date))[0];
}
function statusInfo(item){
  if(!item) return { text:"Sin datos", cls:"yellow", score:50 };
  if(item.maintenanceEnabled && Number(item.frequencyMonths || 0) > 0){
    const base = lastMaintenance(item)?.date || item.installedAt;
    if(base){
      const next = addMonths(base, Number(item.frequencyMonths || 6));
      const diff = daysUntil(next);
      if(diff < 0) return { text:"Vencido", cls:"red", next, score:0 };
      if(diff <= 30) return { text:"Próximo", cls:"yellow", next, score:70 };
      return { text:"Al día", cls:"", next, score:100 };
    }
    return { text:"Sin fecha base", cls:"yellow", score:60 };
  }
  if(item.status === "Dañado") return { text:"Dañado", cls:"red", score:0 };
  if(item.status === "Requiere revisión") return { text:"Requiere revisión", cls:"yellow", score:50 };
  if(item.status === "Regular") return { text:"Regular", cls:"yellow", score:70 };
  return { text:item.status || "Bueno", cls:"", score:100 };
}
function getMaintenanceItems(){ return data.items.map(i => ({ item:i, info:statusInfo(i) })).filter(x => x.info.next); }
function nextMaintenances(limit=5){
  return getMaintenanceItems().sort((a,b)=>daysUntil(a.info.next)-daysUntil(b.info.next)).slice(0,limit);
}
function pendingItems(){
  return data.items.map(i=>({ item:i, info:statusInfo(i) })).filter(x => x.info.cls === "red" || x.info.cls === "yellow" || (x.info.next && daysUntil(x.info.next) <= 30));
}
function generalHealth(){
  if(!data.items.length) return 100;
  const total = data.items.map(i=>statusInfo(i).score ?? 100).reduce((a,b)=>a+b,0);
  return Math.round(total / data.items.length);
}
function itemMatchesFilter(item){
  const category = item.category || item.type || "General";
  const typeOk = itemFilter === "all" || (itemFilter === "aires" && isAir(item)) || category === itemFilter;
  const q = searchTerm.trim().toLowerCase();
  const text = `${item.name} ${item.category || ""} ${item.type || ""} ${item.brand || ""} ${item.model || ""} ${areaName(item.areaId)}`.toLowerCase();
  return typeOk && (!q || text.includes(q));
}
function setItemFilter(f){ itemFilter = f; render(); }
function setSearchTerm(v){ searchTerm = v; render(); }

function render(){
  renderDashboard();
  renderAlerts();
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  if(route.screen === "home" || route.screen === "area" || route.screen === "item") $("navHome").classList.add("active");
  if(route.screen === "timeline") $("navTimeline").classList.add("active");
  if(route.screen === "settings") $("navSettings").classList.add("active");
  $("fab").style.display = ["home","area","item"].includes(route.screen) ? "block" : "none";
  if(route.screen === "home") return renderHome();
  if(route.screen === "area") return renderArea();
  if(route.screen === "item") return renderItem();
  if(route.screen === "timeline") return renderTimeline();
  if(route.screen === "settings") return renderSettings();
}
function renderDashboard(){
  const month = data.records.filter(r=>matchFilter(r.date,"month")).reduce((s,r)=>s+Number(r.amount||0),0);
  const year = data.records.filter(r=>matchFilter(r.date,"year")).reduce((s,r)=>s+Number(r.amount||0),0);
  const total = data.records.reduce((s,r)=>s+Number(r.amount||0),0);
  const health = generalHealth();
  const pending = pendingItems().length;
  const next = nextMaintenances(1)[0];
  const nextDays = next ? daysUntil(next.info.next) : null;
  const nextMain = next ? (nextDays < 0 ? `Vencido ${Math.abs(nextDays)}d` : `${nextDays} días`) : "Sin alertas";
  const nextDetail = next ? `${next.item.name} · ${areaName(next.item.areaId)}` : "No hay mantenimientos programados";
  const stateCls = health < 60 ? "bad" : health < 85 ? "warn" : "";
  const nextCls = nextDays !== null && nextDays < 0 ? "bad" : nextDays !== null && nextDays <= 30 ? "warn" : "";
  const pendingCls = pending > 0 ? "warn" : "";
  $("dashboard").innerHTML = `
    <section class="hero-strip">
      <div class="hero-kpis">
        <span class="kpi"><i class="dot ${stateCls}"></i><small>Estado</small><b>${health}%</b></span>
        <span class="kpi ${pendingCls}"><i>🔧</i><small>Pendientes</small><b>${pending}</b></span>
        <span class="kpi ${nextCls}"><i>❄️</i><small>Próximo</small><b>${nextMain}</b></span>
        <span class="kpi"><i>💰</i><small>Año</small><b>${money(year)}</b></span>
        <span class="kpi"><i>📊</i><small>Hist.</small><b>${money(total)}</b></span>
      </div>
      <div class="hero-context">${next ? "Próximo mantenimiento:" : ""} <b>${nextDetail}</b> <span>${money(month)} mes</span></div>
    </section>`;
}
function renderAlerts(){
  const alerts = data.items.map(i => ({ item:i, info:statusInfo(i), area:data.areas.find(a=>a.id===i.areaId) }))
    .filter(x => x.info.next && daysUntil(x.info.next) <= 30)
    .sort((a,b)=>daysUntil(a.info.next)-daysUntil(b.info.next));
  $("alerts").innerHTML = alerts.slice(0,3).map(x => {
    const d = daysUntil(x.info.next);
    const cls = d < 0 ? "danger" : "";
    const msg = d < 0 ? `vencido hace ${Math.abs(d)} días` : `en ${d} días`;
    return `<div class="alert ${cls}">⚠️ ${x.item.name} (${x.area?.name || "Sin área"}) tiene mantenimiento ${msg}. Próximo: <b>${fmtDate(x.info.next)}</b></div>`;
  }).join("");
}
function renderFilters(){
  const usedCategories = [...new Set(data.items.map(i=>i.category || i.type).filter(Boolean))]
    .filter(c => CATEGORIES.some(x=>x.id===c));
  return `<section class="filter-card">
    <div class="filter-head"><h2>Filtrar artículos</h2><small>${data.items.filter(itemMatchesFilter).length} resultados</small></div>
    <div class="chips">
      <button class="chip ${itemFilter === "all" ? "active" : ""}" onclick="setItemFilter('all')">Todos</button>
      <button class="chip ${itemFilter === "aires" ? "active" : ""}" onclick="setItemFilter('aires')">❄️ Aires</button>
      ${usedCategories.map(c=>`<button class="chip ${itemFilter === c ? "active" : ""}" onclick="setItemFilter('${c}')">${categoryIcon(c)} ${c}</button>`).join("")}
    </div>
    <input class="search" value="${searchTerm}" oninput="setSearchTerm(this.value)" placeholder="Buscar por nombre, marca, modelo o área...">
  </section>`;
}
function itemCard(i){
  const info = statusInfo(i);
  const recs = data.records.filter(r=>r.itemId===i.id).length;
  return `<article class="card" onclick="goItem('${i.id}')">
    <div class="card-row"><div><h3>${isAir(i) ? "❄️ " : categoryIcon(i.category)} ${i.name}</h3><p>${areaIcon(i.areaId)} ${areaName(i.areaId)} · ${i.category || i.type || "Elemento"} · ${i.brand || "Sin marca"}</p></div><span class="pill ${info.cls}">${info.text}</span></div>
    <p>Registros: <b>${recs}</b> · Invertido: <b>${money(itemTotal(i.id))}</b></p>
    ${info.next ? `<p>Próximo mantenimiento: <b>${fmtDate(info.next)}</b> (${daysUntil(info.next) < 0 ? "vencido" : `en ${daysUntil(info.next)} días`})</p>` : ""}
  </article>`;
}
function recentActivity(){
  const recent = data.records.map(r=>({r,item:data.items.find(i=>i.id===r.itemId)})).filter(x=>x.item).sort((a,b)=>b.r.date.localeCompare(a.r.date)).slice(0,3);
  if(!recent.length) return "";
  return `<section class="recent"><div class="section-title mini"><h2>Actividad reciente</h2><button onclick="route={screen:'timeline'};render()">Ver historial</button></div>${recent.map(x=>`<div class="recent-row"><span>✓ ${x.r.type}</span><b>${x.item.name}</b><em>${fmtDate(x.r.date)}</em></div>`).join("")}</section>`;
}

function renderHome(){
  const filteredItems = data.items.filter(itemMatchesFilter);
  $("view").innerHTML = `
    ${renderFilters()}
    ${itemFilter !== "all" || searchTerm ? `<div class="section-title"><h2>Artículos filtrados</h2></div><div class="grid">${filteredItems.length ? filteredItems.map(itemCard).join("") : `<div class="empty">No hay artículos con ese filtro.</div>`}</div>` : ""}
    ${recentActivity()}
    <div class="section-title"><h2>Áreas de la casa</h2><button onclick="openAreaForm()">+ Área</button></div>
    <div class="grid">${data.areas.map(a=>`
      <article class="card" onclick="goArea('${a.id}')">
        <div class="card-row"><div><h3>${a.icon || "🏠"} ${a.name}</h3><p>${data.items.filter(i=>i.areaId===a.id).length} elementos registrados</p></div><div class="money">${money(areaTotal(a.id,"year"))}</div></div>
        <p>Mes: <b>${money(areaTotal(a.id,"month"))}</b> · Histórico: <b>${money(areaTotal(a.id))}</b></p>
      </article>`).join("")}</div>`;
}
function renderArea(){
  const area = data.areas.find(a=>a.id===route.areaId);
  const items = data.items.filter(i=>i.areaId===route.areaId && itemMatchesFilter(i));
  $("view").innerHTML = `
    <section class="area-page">
      <div class="section-title area-title"><button onclick="goHome()">← Casa</button><h2>${area?.icon || "🏠"} ${area?.name || "Área"}</h2><button onclick="openItemForm()">+ Elemento</button></div>
      <div class="area-filter">${renderFilters()}</div>
      <div class="stat wide area-total"><small>Total histórico del área</small><strong>${money(areaTotal(route.areaId))}</strong></div>
      <div class="grid area-items">${items.length ? items.map(itemCard).join("") : `<div class="empty">No hay elementos con ese filtro en esta área.</div>`}</div>
    </section>`;
}
function renderItem(){
  const item = data.items.find(i=>i.id===route.itemId);
  const area = data.areas.find(a=>a.id===item?.areaId);
  const records = data.records.filter(r=>r.itemId===route.itemId).sort((a,b)=>b.date.localeCompare(a.date));
  const info = statusInfo(item || {});
  $("view").innerHTML = `
    <div class="section-title"><button onclick="goArea('${item?.areaId}')">← ${area?.name || "Área"}</button><h2>${item?.name || "Elemento"}</h2><button onclick="openRecordForm()">+ Registro</button></div>
    <article class="card">
      <div class="card-row"><div><h3>${isAir(item) ? "❄️ " : categoryIcon(item?.category)} ${item?.name}</h3><p>${area?.name || "Sin área"} · ${item?.category || item?.type || "Elemento"}</p></div><span class="pill ${info.cls}">${info.text}</span></div>
      <p>Marca: <b>${item?.brand || "No indicada"}</b></p><p>Modelo: <b>${item?.model || "No indicado"}</b></p>
      <p>Instalado: <b>${fmtDate(item?.installedAt)}</b></p><p>Garantía hasta: <b>${fmtDate(item?.warrantyUntil)}</b></p>
      ${info.next ? `<p>Próximo mantenimiento: <b>${fmtDate(info.next)}</b></p>` : ""}
      <p>Total invertido: <b class="money">${money(itemTotal(item?.id))}</b></p>
      <div class="actions"><button class="btn secondary" onclick="event.stopPropagation();openItemForm('${item?.id}')">Editar</button><button class="btn danger" onclick="event.stopPropagation();deleteItem('${item?.id}')">Eliminar</button></div>
    </article>
    <div class="section-title"><h2>Historial</h2></div>
    <div class="timeline">${records.length ? records.map(r=>`
      <div class="time-item"><b>${fmtDate(r.date)} · ${r.type}</b><p class="money">${money(r.amount)}</p><p>${r.summary || "Sin resumen"}</p><p class="muted">Proveedor: ${r.provider || "No indicado"}</p></div>`).join("") : `<div class="empty">Sin historial todavía.</div>`}</div>`;
}
function renderTimeline(){
  const all = data.records.map(r=>({r,item:data.items.find(i=>i.id===r.itemId)})).filter(x=>x.item && itemMatchesFilter(x.item)).sort((a,b)=>b.r.date.localeCompare(a.r.date));
  $("view").innerHTML = `${renderFilters()}<div class="section-title"><h2>Línea de tiempo</h2></div><div class="timeline">${all.length ? all.map(x=>`<div class="time-item"><b>${fmtDate(x.r.date)} · ${x.r.type}</b><p>${x.item.name} · ${areaName(x.item.areaId)}</p><p class="money">${money(x.r.amount)}</p><p>${x.r.summary || "Sin resumen"}</p></div>`).join("") : `<div class="empty">No hay registros con ese filtro.</div>`}</div>`;
}
function renderSettings(){
  $("view").innerHTML = `<div class="section-title"><h2>Datos y respaldo</h2></div><article class="card"><p>Guarda un respaldo JSON para no perder tu historial.</p><div class="settings-actions"><button class="btn" onclick="exportBackup()">Exportar respaldo</button><button class="btn secondary" onclick="$('importFile').click()">Importar respaldo</button><button class="btn danger" onclick="resetApp()">Reiniciar app</button></div></article>`;
}

function goHome(){ route = {screen:"home"}; render(); }
function goArea(id){ route = {screen:"area", areaId:id}; render(); }
function goItem(id){ route = {screen:"item", itemId:id}; render(); }

function openModal(title, html, onSubmit){
  currentModal = onSubmit; $("modalTitle").textContent = title; $("modalForm").innerHTML = html; $("modal").classList.remove("hidden");
}
function closeModal(){ $("modal").classList.add("hidden"); $("modalForm").reset(); currentModal = null; }
function val(name){ return new FormData($("modalForm")).get(name)?.trim(); }

function openAreaForm(){
  openModal("Nueva área", `<div class="field"><label>Nombre</label><input name="name" required placeholder="Ej. Oficina"></div><div class="field"><label>Icono</label><input name="icon" placeholder="🏠"></div><button class="btn">Guardar área</button>`, () => {
    data.areas.push({ id:crypto.randomUUID(), name:val("name"), icon:val("icon") || "🏠" }); closeModal(); saveData();
  });
}
function selected(option, current){ return String(option) === String(current ?? "") ? "selected" : ""; }
function openItemForm(id){
  const item = data.items.find(i=>i.id===id) || {};
  const areaId = item.areaId || route.areaId;
  const currentCategory = item.category || item.type || "Climatización";
  openModal(id ? "Editar elemento" : "Nuevo elemento", `
    <div class="field"><label>Nombre</label><input name="name" required value="${item.name || ""}" placeholder="Ej. Aire acondicionado"></div>
    <div class="field"><label>Categoría</label><select name="category">${CATEGORIES.map(c=>`<option value="${c.id}" ${selected(c.id,currentCategory)}>${c.icon} ${c.label}</option>`).join("")}</select></div>
    <div class="field"><label>Marca</label><input name="brand" value="${item.brand || ""}"></div>
    <div class="field"><label>Modelo</label><input name="model" value="${item.model || ""}"></div>
    <div class="field"><label>Fecha de instalación</label><input type="date" name="installedAt" value="${item.installedAt || ""}"></div>
    <div class="field"><label>Garantía hasta</label><input type="date" name="warrantyUntil" value="${item.warrantyUntil || ""}"></div>
    <div class="field"><label>Estado</label><select name="status"><option ${selected("Bueno", item.status)}>Bueno</option><option ${selected("Regular", item.status)}>Regular</option><option ${selected("Dañado", item.status)}>Dañado</option><option ${selected("Requiere revisión", item.status)}>Requiere revisión</option></select></div>
    <div class="field"><label>Calendario de mantenimiento</label><select name="frequencyMonths">
      <option value="0" ${selected(0, Number(item.frequencyMonths || 0))}>Sin alerta automática</option>
      ${Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${selected(m, Number(item.frequencyMonths || 0))}>Cada ${m} mes${m===1?"":"es"}</option>`).join("")}
    </select><small>En aires acondicionados es obligatorio elegir cada 4 o 6 meses. En los demás artículos puedes dejarlo sin alerta o elegir de 1 a 12 meses.</small></div>
    <button class="btn">Guardar elemento</button>`, () => {
      const freq = Number(val("frequencyMonths") || 0);
      const name = val("name");
      const air = isAirName(name);
      if(air && ![4,6].includes(freq)){
        alert("Para los aires acondicionados debes elegir una alerta de 4 o 6 meses.");
        return;
      }
      const payload = { id:id || crypto.randomUUID(), areaId, name, category:val("category"), type:name, brand:val("brand"), model:val("model"), installedAt:val("installedAt"), warrantyUntil:val("warrantyUntil"), status:val("status"), maintenanceEnabled: freq > 0, frequencyMonths:freq };
      if(air){ payload.maintenanceEnabled = true; }
      if(id) data.items = data.items.map(i=>i.id===id?payload:i); else data.items.push(payload);
      closeModal(); saveData();
    });
}
function openRecordForm(){
  openModal("Registrar mantenimiento", `
    <div class="field"><label>Tipo</label><select name="type"><option>Mantenimiento</option><option>Reparación</option><option>Mejora</option><option>Construcción</option><option>Compra</option><option>Instalación</option></select></div>
    <div class="field"><label>Fecha</label><input type="date" name="date" value="${todayISO()}" required></div>
    <div class="field"><label>Monto</label><input type="number" step="0.01" name="amount" placeholder="0.00"></div>
    <div class="field"><label>Proveedor / técnico</label><input name="provider" placeholder="Nombre o empresa"></div>
    <div class="field"><label>Resumen</label><textarea name="summary" placeholder="Qué se le hizo..."></textarea></div>
    <button class="btn">Guardar registro</button>`, () => {
      data.records.push({ id:crypto.randomUUID(), itemId:route.itemId, type:val("type"), date:val("date"), amount:Number(val("amount") || 0), provider:val("provider"), summary:val("summary") });
      closeModal(); saveData();
    });
}
function deleteItem(id){
  if(!confirm("¿Eliminar este elemento y todo su historial?")) return;
  data.items = data.items.filter(i=>i.id!==id); data.records = data.records.filter(r=>r.itemId!==id); route = {screen:"area", areaId:route.areaId}; saveData();
}
function exportBackup(){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `homefix-respaldo-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href);
}
function resetApp(){ if(confirm("¿Seguro? Esto borra todos los datos locales.")){ localStorage.removeItem(STORAGE_KEY); data = structuredClone(defaultData); goHome(); } }

$("modalForm").addEventListener("submit", e => { e.preventDefault(); if(currentModal) currentModal(); });
$("closeModal").onclick = closeModal;
$("fab").onclick = () => { if(route.screen === "home") openAreaForm(); else if(route.screen === "area") openItemForm(); else if(route.screen === "item") openRecordForm(); };
$("navHome").onclick = goHome;
$("navTimeline").onclick = () => { route={screen:"timeline"}; render(); };
$("navSettings").onclick = () => { route={screen:"settings"}; render(); };
$("btnBackup").onclick = exportBackup;
$("importFile").onchange = (e) => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { data = JSON.parse(reader.result); saveData(); alert("Respaldo importado correctamente."); } catch { alert("El archivo no es válido."); } };
  reader.readAsText(file);
};
if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js")); }
render();


window.addEventListener("load", () => {
  const splash = document.getElementById("splash");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 750);
  }, 2000);
});
