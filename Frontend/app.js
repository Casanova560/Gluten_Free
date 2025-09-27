/* ===============================
   GlutenFree ERP Front (Vanilla)
   =============================== */

const API_BASE = window.API_BASE || 'http://localhost:8000';
const api = (p) => `${API_BASE}${p}`;
const today = () => new Date().toISOString().slice(0,10);

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];

const Toast = (() => {
  const cont = $('#toastContainer');
  return (msg, type='info') => {
    if (!cont) return alert(`${type.toUpperCase()}: ${msg}`);
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    cont.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); t.addEventListener('transitionend', () => t.remove()); }, 2800);
  };
})();

const Modal = (() => {
  const dlg = $('#modal');
  const body = $('#modalBody');
  const title = $('#modalTitle');
  const primary = $('#modalPrimary');
  const btnCancel = $('#modalCancel');
  const btnCloseX = $('#modalCloseX');
  let onOk = null;

  const safeClose = (e) => { e?.preventDefault?.(); dlg?.close?.(); };

  primary?.addEventListener('click', (e) => {
    if (onOk) {
      e.preventDefault();
      Promise.resolve(onOk()).then(ok => {
        if (ok !== false) dlg.close();
      }).catch(err => Toast(err?.message || 'Error', 'error'));
    }
  });
  btnCancel?.addEventListener('click', safeClose);
  btnCloseX?.addEventListener('click', safeClose);
  dlg?.addEventListener('cancel', safeClose); // ESC
  dlg?.addEventListener('close', () => { if (body) body.innerHTML=''; onOk=null; });

  return {
    open({title: t, content, onOk: cb, okText='Guardar'}) {
      if (!dlg) return Toast('Modal no disponible en este layout','error');
      title.textContent = t;
      body.innerHTML = '';
      body.appendChild(content);
      primary.textContent = okText;
      onOk = cb;
      dlg.showModal();
    },
    close(){ dlg?.close?.(); }
  };
})();

// --- Utils ---
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(await r.text().catch(()=>r.statusText) || r.statusText);
  return r.json();
}
const debounce = (fn, ms=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const fmt = {
  money: (n) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC', maximumFractionDigits:2}).format(Number(n||0)),
  date: (s) => s?.slice(0,10) || ''
};
const slug = (s) => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/(^-|-$)/g,'').toLowerCase();

// === Nuevo: helper de costos MP (por unidad base) ===
async function getCostosMP(ids=[]) {
  if (!ids.length) return {};
  try {
    const res = await fetchJSON(api(`/costos/mp?ids=${ids.join(',')}`));
    // Acepta {id: number} o {id: {costo_unitario_crc: number}}
    const out = {};
    Object.entries(res||{}).forEach(([k,v])=>{
      out[k] = typeof v === 'number' ? v : Number(v?.costo_unitario_crc||0);
    });
    return out;
  } catch {
    return {};
  }
}

// --- Reactive Store ---
const Store = {
  state: { uoms:[], productos:[], clientes:[], proveedores:[], empleados:[] },
  listeners: new Set(),
  set(partial){ Object.assign(this.state, partial); this.listeners.forEach(l=>l(this.state)); },
  subscribe(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
};
async function loadCatalogs() {
  try{
    const [uoms, productos, clientes, proveedores, empleados] = await Promise.all([
      fetchJSON(api('/uom')),
      fetchJSON(api('/productos')),
      fetchJSON(api('/contactos/clientes')),
      fetchJSON(api('/contactos/proveedores')),
      fetchJSON(api('/contactos/empleados')),
    ]);
    Store.set({uoms, productos, clientes, proveedores, empleados});
  }catch(e){ Toast('No se pudieron cargar catálogos','error'); }
}
loadCatalogs();

// --- Components ---
function Select({name, items, valueKey='id', labelKey='nombre', value='', placeholder='Seleccione…', required=false}) {
  const el = document.createElement('select');
  el.name = name; if (required) el.required = true;
  const ph = document.createElement('option'); ph.value=''; ph.textContent = placeholder; el.appendChild(ph);
  (items||[]).forEach(it=>{
    const opt=document.createElement('option');
    opt.value = it[valueKey];
    opt.textContent = it[labelKey] ?? it[valueKey];
    if (String(value) === String(opt.value)) opt.selected = true;
    el.appendChild(opt);
  });
  return el;
}
function Input({name, type='text', placeholder='', step=null, required=false, value=''}) {
  const el = document.createElement('input');
  el.name=name; el.type=type; el.placeholder=placeholder; el.value=value||'';
  if (step) el.step=step;
  if (required) el.required = true;
  return el;
}
function Field(label, control, {hint=null}={}) {
  const w = document.createElement('label'); w.className='field';
  const s = document.createElement('span'); s.textContent = label; if (hint) s.title = hint;
  w.append(s, control); return w;
}
function Toolbar(...children){ const bar=document.createElement('div'); bar.className='toolbar'; children.forEach(c=>bar.appendChild(c)); return bar; }
function Table({columns, rows}) {
  const wrap = document.createElement('div'); wrap.className='table-wrap';
  const table = document.createElement('table'); table.className='table';
  const thead = document.createElement('thead'); const trh = document.createElement('tr');
  columns.forEach(c => { const th=document.createElement('th'); th.textContent=c.label; trh.appendChild(th);});
  thead.appendChild(trh);
  const tbody = document.createElement('tbody');
  (rows||[]).forEach(r=>{
    const tr=document.createElement('tr');
    columns.forEach(c => {
      const td=document.createElement('td');
      td.textContent = c.format ? c.format(r[c.key], r) : (r[c.key] ?? '');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.append(thead, tbody); wrap.appendChild(table); return wrap;
}

// --- Router ---
const routes = {};
function route(path, renderFn){ routes[path]=renderFn; }
function navigate(hash){
  const view = $('#view'); if (!view) return;
  view.innerHTML='';
  (routes[hash] || routes['#/dashboard'])(view);
  $$('.menu a').forEach(a => a.classList.toggle('active', a.getAttribute('href')===hash));
}

/* ============ Screens ============ */

route('#/dashboard', async (root) => {
  const data = await fetchJSON(api('/reportes/dashboard')).catch(()=>({ventas:[],compras:[],margen:[]}));
  const kpi = document.createElement('div'); kpi.className='kpi-grid';
  const suma = arr => arr.reduce((a,b)=>a+Number(b.total_crc||0),0);
  const card = (title, value, foot='')=>{
    const c=document.createElement('div'); c.className='card kpi';
    c.innerHTML=`<h3>${title}</h3><div class="big">${fmt.money(value)}</div><small>${foot}</small>`;
    return c;
  };
  kpi.append(
    card('Ventas 30d', suma(data.ventas), data.ventas[0]?.fecha ? `Último: ${fmt.date(data.ventas[0].fecha)}`:''),
    card('Compras 30d', suma(data.compras), data.compras[0]?.fecha ? `Último: ${fmt.date(data.compras[0].fecha)}`:''),
    card('Margen directo (últ. mes)', data.margen.length ? Number(data.margen[0].margen_directo_crc||0):0, data.margen[0]?.ym || '')
  );
  root.appendChild(kpi);

  const grid = document.createElement('div'); grid.className='grid-2';
  grid.append(
    Table({columns:[{key:'fecha',label:'Fecha'},{key:'total_crc',label:'Ventas',format:fmt.money}], rows:data.ventas}),
    Table({columns:[{key:'fecha',label:'Fecha'},{key:'total_crc',label:'Compras',format:fmt.money}], rows:data.compras})
  );
  root.appendChild(grid);
});

route('#/uom', (root) => {
  const form = document.createElement('form'); form.className='panel';
  form.append(
    Field('Código', Input({name:'codigo', required:true})),
    Field('Nombre', Input({name:'nombre', required:true})),
    (()=>{
      const box=document.createElement('div'); box.className='form-actions';
      const save=document.createElement('button'); save.type='submit'; save.className='btn-primary'; save.textContent='Crear UOM';
      const cancel=document.createElement('button'); cancel.type='button'; cancel.className='btn'; cancel.textContent='Cancelar'; cancel.onclick=()=>form.reset();
      box.append(save,cancel); return box;
    })()
  );
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await fetchJSON(api('/uom'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      Toast('UOM creada','success');
      const uoms = await fetchJSON(api('/uom')); Store.set({uoms});
      form.reset();
    } catch(e){ Toast(e.message,'error'); }
  });
  root.appendChild(form);

  const sub = Store.subscribe(({uoms}) => {
    root.querySelector('.table-wrap')?.remove();
    root.appendChild(Table({columns:[{key:'codigo',label:'Código'},{key:'nombre',label:'Nombre'}], rows:uoms}));
  });
  sub(Store.state);
});

route('#/productos', (root) => {
  const header = Toolbar(
    (()=>{ const b=document.createElement('button'); b.className='btn-primary'; b.textContent='Nuevo producto'; b.onclick=()=>openProductoModal(); return b; })(),
    (()=>{ const i=Input({name:'q',placeholder:'Buscar…'}); i.addEventListener('input', debounce(()=>renderList(i.value),250)); return i;})()
  );
  root.appendChild(header);

  function renderList(q=null){
    const rows = Store.state.productos.filter(p => !q || (p.nombre?.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase())));
    root.querySelector('.table-wrap')?.remove();
    root.appendChild(Table({
      columns:[
        {key:'sku',label:'Código'},
        {key:'nombre',label:'Nombre'},
        {key:'tipo',label:'Tipo'},
        {key:'uom_base_id',label:'UOM'},
        {key:'activo',label:'Activo'}
      ],
      rows
    }));
  }
  renderList();

  function openProductoModal(prefill={tipo:'MP'}){
    const form = document.createElement('form'); form.className='form-grid';
    const sku = Field('Código interno (SKU)', Input({name:'sku', placeholder:'Opcional'}), {hint:'Si se deja vacío, se autogenera'});
    const nom = Field('Nombre', Input({name:'nombre', required:true}));
    const tipo = Field('Tipo', (()=>{ const s=Select({name:'tipo',items:[{id:'MP',nombre:'Materia Prima'},{id:'PT',nombre:'Producto Terminado'}], valueKey:'id'}); s.required=true; s.value=prefill.tipo; return s; })());
    const uom = Field('UOM base', Select({name:'uom_base_id', items:Store.state.uoms, valueKey:'id', labelKey:'nombre', required:true}));
    const activo = Field('Activo', (()=>{ const s=Select({name:'activo', items:[{id:1,nombre:'Sí'},{id:0,nombre:'No'}], valueKey:'id'}); s.value=1; return s;})());
    form.append(sku,nom,tipo,uom,activo);

    Modal.open({
      title:'Nuevo producto',
      content: form,
      onOk: async () => {
        const payload = Object.fromEntries(new FormData(form).entries());
        if (!payload.sku) payload.sku = `${slug(payload.nombre).slice(0,12)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
        payload.uom_base_id = Number(payload.uom_base_id);
        try {
          await fetchJSON(api('/productos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          const productos = await fetchJSON(api('/productos')); Store.set({productos});
          Toast('Producto creado','success');
        } catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
});

route('#/contactos', (root) => {
  const tabs = document.createElement('div'); tabs.className='tabs';
  tabs.innerHTML = `
    <button class="active" data-t="clientes">Clientes</button>
    <button data-t="proveedores">Proveedores</button>
    <button data-t="empleados">Empleados</button>
    <span class="spacer"></span>
    <button class="btn-primary" id="btnNuevoContacto">+ Nuevo</button>`;
  root.appendChild(tabs);

  const list = document.createElement('div'); root.appendChild(list);
  function render(kind='clientes'){
    tabs.querySelectorAll('button[data-t]').forEach(b=>b.classList.toggle('active', b.dataset.t===kind));
    const rows = Store.state[kind];
    list.innerHTML='';
    list.appendChild(Table({columns:[
      {key:'nombre',label:'Nombre'},
      {key:'num_doc',label:'Documento'},
      {key:'telefono',label:'Teléfono'},
      {key:'email',label:'Email'},
      {key:'direccion',label:'Dirección'}
    ], rows}));
  }
  render('clientes');

  tabs.addEventListener('click', (e)=>{
    if (e.target.matches('[data-t]')) render(e.target.dataset.t);
    if (e.target.id==='btnNuevoContacto') openModalNew();
  });

  function openModalNew(){
    const form=document.createElement('form'); form.className='form-grid';
    const tipo = Field('Tipo', (()=>{ const s=Select({name:'tipo',items:[{id:'cliente',nombre:'Cliente'},{id:'proveedor',nombre:'Proveedor'},{id:'empleado',nombre:'Empleado'}], valueKey:'id'}); s.required=true; return s; })());
    const nombre= Field('Nombre', Input({name:'nombre', required:true}));
    const numdoc= Field('Documento', Input({name:'num_doc'}));
    const tel   = Field('Teléfono', Input({name:'telefono'}));
    const email = Field('Email', Input({name:'email', type:'email'}));
    const dir   = Field('Dirección', Input({name:'direccion'}));
    form.append(tipo,nombre,numdoc,tel,email,dir);

    Modal.open({
      title:'Nuevo contacto',
      content:form,
      onOk: async ()=>{
        const payload = Object.fromEntries(new FormData(form).entries());
        try{
          if (payload.tipo==='cliente') await fetchJSON(api('/contactos/clientes'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          else if (payload.tipo==='proveedor') await fetchJSON(api('/contactos/proveedores'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          else await fetchJSON(api('/contactos/empleados'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          const [clientes, proveedores, empleados] = await Promise.all([
            fetchJSON(api('/contactos/clientes')),
            fetchJSON(api('/contactos/proveedores')),
            fetchJSON(api('/contactos/empleados')),
          ]);
          Store.set({clientes, proveedores, empleados});
          Toast('Contacto creado','success');
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
});

route('#/ventas', (root) => {
  const form = document.createElement('form'); form.className='panel form-grid';
  const fecha = Field('Fecha', Input({name:'fecha', type:'date', required:true, value: today()}));
  const cliente = Field('Cliente', Select({name:'cliente_id', items:Store.state.clientes, required:true}));
  const cond = Field('Condición', (()=>{ const s=Select({name:'condicion_pago', items:[{id:'CONTADO',nombre:'Contado'},{id:'CREDITO',nombre:'Crédito'}], valueKey:'id'}); s.required=true; s.value='CONTADO'; return s; })());
  const dias = Field('Días crédito', Input({name:'dias_credito', type:'number', step:'1'}));
  const nota = Field('Notas', Input({name:'nota'}));
  const actions = document.createElement('div'); actions.className='form-actions';
  const btn = document.createElement('button'); btn.type='submit'; btn.className='btn-primary'; btn.textContent='Crear venta';
  const cancel = document.createElement('button'); cancel.type='button'; cancel.className='btn'; cancel.textContent='Cancelar'; cancel.onclick=()=>form.reset();
  actions.append(btn,cancel);
  form.append(fecha, cliente, cond, dias, nota, actions);
  root.appendChild(form);

  let ventaId = null;
  const itemsPanel = document.createElement('div'); itemsPanel.className='panel';
  itemsPanel.innerHTML = `<h3>Ítems</h3>`;
  const lines = document.createElement('div'); lines.className='lines';
  const addLineBtn = document.createElement('button'); addLineBtn.type='button'; addLineBtn.textContent='+ Agregar línea';
  const totals = document.createElement('div'); totals.className='totals'; totals.innerHTML = `<b>Total:</b> <span id="ventaTotal">₡0,00</span>`;
  itemsPanel.append(lines, addLineBtn, totals);
  root.appendChild(itemsPanel);

  function lineComponent(){
    const row=document.createElement('div'); row.className='line';
    const prodWrap = Field('Producto', Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), required:true}));
    const addPT = document.createElement('button'); addPT.type='button'; addPT.className='icon-btn'; addPT.textContent='＋'; addPT.title='Nuevo PT';
    addPT.onclick=()=>openProductoInline('PT', prodWrap.querySelector('select'));
    prodWrap.appendChild(addPT);

    const uom  = Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true}));
    const cant = Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', required:true, value:'1'}));
    const precio= Field('Precio', Input({name:'precio_unitario_crc', type:'number', step:'0.01', required:true, value:'0'}));
    const desc = Field('Desc', Input({name:'descuento_crc', type:'number', step:'0.01', value:'0'}));
    const del = document.createElement('button'); del.type='button'; del.className='icon-btn'; del.textContent='🗑'; del.onclick=()=>{ row.remove(); calc(); };
    row.append(prodWrap, uom, cant, precio, desc, del);
    row.addEventListener('input', calc);
    return row;
  }
  function calc(){
    let total=0; $$('.line', lines).forEach(row=>{
      const g = Object.fromEntries($$('select,input',row).map(el=>[el.name, el.value]));
      total += (Number(g.precio_unitario_crc||0) * Number(g.cantidad||0)) - Number(g.descuento_crc||0);
    });
    $('#ventaTotal').textContent = fmt.money(total);
    return total;
  }
  addLineBtn.onclick = ()=> lines.appendChild(lineComponent());

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.moneda='CRC';
    try{
      const res = await fetchJSON(api('/ventas'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      ventaId = res.id; Toast(`Venta #${ventaId} creada`,'success');
    }catch(err){ Toast(err.message,'error'); }
  });

  // Guardar línea por línea (delegación)
  lines.addEventListener('change', debounce(async (e)=>{
    if (!ventaId) return;
    const row = e.target.closest('.line'); if(!row) return;
    const data = Object.fromEntries($$('select,input', row).map(el=>[el.name, el.value]));
    if (!data.producto_id) return;
    try{
      await fetchJSON(api(`/ventas/${ventaId}/items`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      const tot = await fetchJSON(api(`/ventas/${ventaId}/totales`));
      $('#ventaTotal').textContent = fmt.money(tot.total_crc||0);
      Toast('Ítem guardado','success');
    }catch(e){ Toast(e.message,'error'); }
  }, 400));

  function openProductoInline(tipo, selectEl){
    const form = document.createElement('form'); form.className='form-grid';
    form.append(
      Field('Código interno (SKU)', Input({name:'sku', placeholder:'Opcional'})),
      Field('Nombre', Input({name:'nombre', required:true})),
      Field('Tipo', (()=>{ const s=Select({name:'tipo', items:[{id:'MP',nombre:'Materia Prima'},{id:'PT',nombre:'Producto Terminado'}], valueKey:'id', required:true}); s.value=tipo; return s;})()),
      Field('UOM base', Select({name:'uom_base_id', items:Store.state.uoms, valueKey:'id', labelKey:'nombre', required:true}))
    );
    Modal.open({
      title:'Nuevo producto',
      content: form,
      onOk: async ()=>{
        const payload = Object.fromEntries(new FormData(form).entries());
        if (!payload.sku) payload.sku = `${slug(payload.nombre).slice(0,12)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
        payload.uom_base_id = Number(payload.uom_base_id);
        try{
          await fetchJSON(api('/productos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          const productos = await fetchJSON(api('/productos')); Store.set({productos});
          if (selectEl) {
            selectEl.innerHTML='';
            const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione…'; selectEl.appendChild(ph);
            Store.state.productos.filter(p=>p.tipo==='PT').forEach(p=>selectEl.appendChild(new Option(p.nombre, p.id)));
            selectEl.value = Store.state.productos.find(p=>p.nombre===payload.nombre)?.id || '';
          }
          Toast('Producto creado','success');
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
});

route('#/compras', (root) => {
  const form = document.createElement('form'); form.className='panel form-grid';
  const fecha = Field('Fecha', Input({name:'fecha', type:'date', required:true, value: today()}));
  const prov  = Field('Proveedor', Select({name:'proveedor_id', items:Store.state.proveedores, required:true}));
  const cond  = Field('Condición', (()=>{ const s=Select({name:'condicion_pago', items:[{id:'CONTADO',nombre:'Contado'},{id:'CREDITO',nombre:'Crédito'}], valueKey:'id'}); s.required=true; s.value='CONTADO'; return s; })());
  const dias  = Field('Días crédito', Input({name:'dias_credito', type:'number'}));
  const nota  = Field('Notas', Input({name:'nota'}));
  const actions = document.createElement('div'); actions.className='form-actions';
  const btn   = document.createElement('button'); btn.type='submit'; btn.className='btn-primary'; btn.textContent='Crear compra';
  const cancel = document.createElement('button'); cancel.type='button'; cancel.className='btn'; cancel.textContent='Cancelar'; cancel.onclick=()=>form.reset();
  actions.append(btn,cancel);
  form.append(fecha, prov, cond, dias, nota, actions);
  root.appendChild(form);

  let compraId=null;
  const panel = document.createElement('div'); panel.className='panel';
  panel.innerHTML='<h3>Ítems</h3>';
  const lines = document.createElement('div'); lines.className='lines';
  const add = document.createElement('button'); add.type='button'; add.textContent='+ Agregar línea';
  const totals = document.createElement('div'); totals.className='totals'; totals.innerHTML=`<b>Total:</b> <span id="compraTotal">₡0,00</span>`;
  panel.append(lines, add, totals); root.appendChild(panel);

  function line(){
    const row=document.createElement('div'); row.className='line';
    const prodSel = Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='MP'), required:true});
    const prodWrap = Field('Producto (MP)', prodSel);
    const addMP = document.createElement('button'); addMP.type='button'; addMP.className='icon-btn'; addMP.textContent='＋'; addMP.title='Nuevo MP';
    addMP.onclick=()=>quickProduct('MP', prodSel);
    prodWrap.appendChild(addMP);

    const uomSel  = Select({name:'uom_id', items:Store.state.uoms, required:true});
    const uom  = Field('UOM', uomSel);
    const cant = Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', value:'1', required:true}));
    const costoInput = Input({name:'costo_unitario_crc', type:'number', step:'0.01', value:'0', required:true});
    const costo= Field('Costo', costoInput);
    const desc = Field('Desc', Input({name:'descuento_crc', type:'number', step:'0.01', value:'0'}));
    const del  = document.createElement('button'); del.type='button'; del.className='icon-btn'; del.textContent='🗑'; del.onclick=()=>{ row.remove(); calc(); };
    row.append(prodWrap, uom, cant, costo, desc, del);

    // Bloquear UOM a base y proponer costo desde /costos/mp
    row.addEventListener('change', async (e)=>{
      if (e.target.name === 'producto_id') {
        const pid = Number(e.target.value||0);
        const prod = Store.state.productos.find(p=>p.id===pid);
        if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
        else { uomSel.disabled = false; }
        // Traer costo sugerido para este MP
        if (pid) {
          const map = await getCostosMP([pid]);
          const c = Number(map[pid] || 0);
          if (c > 0) {
            if (!Number(costoInput.value)) costoInput.value = String(c);
            costoInput.placeholder = String(c);
          }
        }
        calc();
      }
    });

    row.addEventListener('input', calc);
    return row;
  }
  function calc(){
    let total=0; $$('.line', lines).forEach(r=>{
      const g=Object.fromEntries($$('select,input',r).map(el=>[el.name, el.value]));
      total += (Number(g.costo_unitario_crc||0)*Number(g.cantidad||0)) - Number(g.descuento_crc||0);
    });
    $('#compraTotal').textContent = fmt.money(total);
    return total;
  }
  add.onclick = ()=> lines.appendChild(line());

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const payload=Object.fromEntries(new FormData(form).entries());
    payload.moneda='CRC';
    try{
      const res=await fetchJSON(api('/compras'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      compraId=res.id; Toast(`Compra #${compraId} creada`,'success');
    }catch(e){ Toast(e.message,'error'); }
  });

  // Delegación para cada fila
  lines.addEventListener('change', debounce(async (e)=>{
    if (!compraId) return;
    const row=e.target.closest('.line'); if(!row) return;
    const data=Object.fromEntries($$('select,input',row).map(el=>[el.name, el.value]));
    if (!data.producto_id) return;
    try{
      await fetchJSON(api(`/compras/${compraId}/items`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      const tot = await fetchJSON(api(`/compras/${compraId}/totales`));
      $('#compraTotal').textContent = fmt.money(tot.total_crc||0);
      Toast('Ítem guardado','success');
    }catch(e){ Toast(e.message,'error'); }
  }, 400));

  function quickProduct(tipo, selectEl){
    const form = document.createElement('form'); form.className='form-grid';
    form.append(
      Field('Código interno (SKU)', Input({name:'sku', placeholder:'Opcional'})),
      Field('Nombre', Input({name:'nombre', required:true})),
      Field('Tipo', (()=>{ const s=Select({name:'tipo', items:[{id:'MP',nombre:'Materia Prima'},{id:'PT',nombre:'Producto Terminado'}], valueKey:'id', required:true}); s.value=tipo; return s;})()),
      Field('UOM base', Select({name:'uom_base_id', items:Store.state.uoms, valueKey:'id', labelKey:'nombre', required:true}))
    );
    Modal.open({
      title:'Nuevo producto',
      content: form,
      onOk: async ()=>{
        const payload = Object.fromEntries(new FormData(form).entries());
        if (!payload.sku) payload.sku = `${slug(payload.nombre).slice(0,12)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
        payload.uom_base_id = Number(payload.uom_base_id);
        try{
          await fetchJSON(api('/productos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          const productos = await fetchJSON(api('/productos')); Store.set({productos});
          if (selectEl) {
            selectEl.innerHTML='';
            const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione…'; selectEl.appendChild(ph);
            Store.state.productos.filter(p=>p.tipo==='MP').forEach(p=>selectEl.appendChild(new Option(p.nombre, p.id)));
            selectEl.value = Store.state.productos.find(p=>p.nombre===payload.nombre)?.id || '';
            selectEl.dispatchEvent(new Event('change'));
          }
          Toast('Producto creado','success');
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
});

route('#/recetas', (root)=>{
  const header = Toolbar(
    (()=>{ const b=document.createElement('button'); b.className='btn-primary'; b.textContent='Nueva receta'; b.onclick=()=>openRecetaModal(); return b; })(),
    (()=>{ const i=Input({name:'q',placeholder:'Buscar receta…'}); i.addEventListener('input', debounce(()=>renderList(i.value),250)); return i;})()
  );
  root.appendChild(header);

  async function renderList(q=null){
    const recetas = await fetchJSON(api('/recetas')).catch(()=>[]);
    const rows = recetas.filter(r => !q || (r.nombre?.toLowerCase().includes(q.toLowerCase())));
    root.querySelector('.table-wrap')?.remove();
    root.appendChild(Table({columns:[
      {key:'nombre',label:'Nombre'},
      {key:'producto_salida_id',label:'Prod. salida'},
      {key:'uom_salida_id',label:'UOM salida'},
      {key:'activo',label:'Activo'}
    ], rows}));
  }
  renderList();

  // === Costeo de receta (usa costos base desde compras) ===
  const costPanel = document.createElement('div'); costPanel.className='panel';
  costPanel.innerHTML = `
    <h3>Costeo de receta</h3>
    <div class="form-grid">
      <label class="field"><span>Receta</span><select name="receta_sel"></select></label>
      <label class="field"><span>Rendimiento (opcional)</span><input name="rend" type="number" step="0.000001" placeholder="Si vacío, usa salidas de la receta"></label>
      <label class="field"><span>Indirectos</span>
        <select name="modo_ind">
          <option value="global">Usar % global</option>
          <option value="custom">Usar % personalizado</option>
        </select>
      </label>
      <label class="field"><span>% personalizado</span><input name="pct" type="number" step="0.01" placeholder="18 = 18%" disabled></label>
      <div class="form-actions">
        <button id="btnCostearReceta" class="btn-primary">Calcular</button>
      </div>
    </div>
    <div id="recetaCostKPI" class="kpi-grid" style="margin-top:10px"></div>
    <div id="recetaCostTable"></div>
  `;
  root.appendChild(costPanel);

  // Cargar recetas y config de % global
  let globalPct = 0; // 0.18 = 18%
  (async ()=>{
    const [recetas, cfg] = await Promise.all([
      fetchJSON(api('/recetas')).catch(()=>[]),
      fetchJSON(api('/finanzas/config/indirectos')).catch(()=>({pct:0}))
    ]);
    const sel = costPanel.querySelector('select[name="receta_sel"]');
    sel.innerHTML = '<option value="">Seleccione…</option>';
    recetas.forEach(r => sel.appendChild(new Option(r.nombre, r.id)));
    globalPct = Number(cfg.pct || 0);
    costPanel.querySelector('input[name="pct"]').placeholder = `${(globalPct*100).toFixed(2)} (global)`;
  })();

  // habilitar/deshabilitar % personalizado
  costPanel.querySelector('select[name="modo_ind"]').onchange = (e)=>{
    const en = e.target.value === 'custom';
    const pct = costPanel.querySelector('input[name="pct"]');
    pct.disabled = !en;
    if (!en) pct.value = '';
  };

  const normPct = (p)=> {
    if (p == null || p === '') return null;
    const n = Number(p);
    if (!isFinite(n) || n < 0) return null;
    return n > 1 ? (n/100) : n;
  };

  costPanel.querySelector('#btnCostearReceta').onclick = async ()=>{
    const rid = Number(costPanel.querySelector('select[name="receta_sel"]').value || 0);
    if (!rid) return Toast('Elegí una receta','error');
    const rendInput = costPanel.querySelector('input[name="rend"]').value;
    const custom = costPanel.querySelector('select[name="modo_ind"]').value === 'custom';
    const pctInput = costPanel.querySelector('input[name="pct"]').value;

    try{
      // Traemos detalle de receta (ingredientes con cantidades)
      const data = await fetchJSON(api(`/recetas/${rid}/ingredientes`)).catch(()=>[]);
      const ingredientes = Array.isArray(data) ? data : (data.ingredientes || []);

      // Costos por MP desde compras (map id -> costo por unidad base)
      const ids = [...new Set(ingredientes.map(i=>Number(i.producto_id)).filter(Boolean))];
      const costos = await getCostosMP(ids);

      // Calcular costo por ítem (costo_u_base * cantidad)
      const rows = ingredientes.map(it => {
        const unit = (typeof costos[it.producto_id] === 'number') ? Number(costos[it.producto_id]||0) : Number(it.costo_unitario_crc||0);
        const qty  = Number(it.cantidad || 0);
        const total = unit * qty;
        return {
          ...it,
          nombre: it.nombre || (Store.state.productos.find(p=>p.id===Number(it.producto_id))?.nombre || `#${it.producto_id}`),
          costo_unitario_crc: unit,
          costo_total_crc: total
        };
      });

      const directo = rows.reduce((acc, r)=> acc + Number(r.costo_total_crc || 0), 0);

      // % indirecto
      const p = custom ? (normPct(pctInput) ?? globalPct) : globalPct;
      const indirecto = directo * (p || 0);
      const total = directo + indirecto;

      // Rendimiento: usar salidas de la receta si no dieron uno manual
      let rendimiento = Number(rendInput||0);
      if (!rendimiento) {
        const outs = await fetchJSON(api(`/recetas/${rid}/salidas`)).catch(()=>[]);
        rendimiento = (outs || []).reduce((a,b)=> a + Number(b.rendimiento || b.cantidad || 0), 0);
      }
      const unitario = (rendimiento && rendimiento > 0) ? (total / rendimiento) : null;

      // KPIs
      const kpi = costPanel.querySelector('#recetaCostKPI'); kpi.innerHTML='';
      const mk = (t,v)=>{ const c=document.createElement('div'); c.className='card kpi'; c.innerHTML=`<h3>${t}</h3><div class="big">${fmt.money(v)}</div>`; return c; };
      kpi.append(
        mk('Directo', directo),
        mk('Indirecto', indirecto),
        mk('Total receta', total),
        mk('Unitario estimado', unitario ?? 0)
      );

      // Tabla
      costPanel.querySelector('#recetaCostTable').innerHTML = '';
      costPanel.querySelector('#recetaCostTable').appendChild(
        Table({columns:[
          {key:'nombre',label:'Ingrediente / MP'},
          {key:'cantidad',label:'Cant.'},
          {key:'costo_unitario_crc',label:'Costo u.',format:fmt.money},
          {key:'costo_total_crc',label:'Costo total',format:fmt.money}
        ], rows})
      );

    }catch(e){ Toast(e.message,'error'); }
  };

  function openRecetaModal(){
    const form = document.createElement('form'); form.className='form-grid';
    const nombre = Field('Nombre', Input({name:'nombre', required:true}));
    const prodOut= Field('Producto salida (PT)', Select({name:'producto_salida_id', items:Store.state.productos.filter(p=>p.tipo==='PT')}));
    const addPT = document.createElement('button'); addPT.type='button'; addPT.className='icon-btn'; addPT.textContent='＋'; addPT.title='Nuevo PT'; addPT.onclick=()=>quickProduct('PT', prodOut.querySelector('select'));
    prodOut.appendChild(addPT);
    const uomOut = Field('UOM salida', Select({name:'uom_salida_id', items:Store.state.uoms}));
    const nota   = Field('Notas', Input({name:'nota'}));
    form.append(nombre, prodOut, uomOut, nota);

    const ingredientes = document.createElement('div'); ingredientes.className='subpanel';
    ingredientes.innerHTML = '<h4>Ingredientes (MP)</h4>';
    const ingLines = document.createElement('div'); ingLines.className='lines';
    const addIng = document.createElement('button'); addIng.type='button'; addIng.textContent='+ Agregar';
    ingredientes.append(ingLines, addIng);

    const salidas = document.createElement('div'); salidas.className='subpanel';
    salidas.innerHTML = '<h4>Salidas (PT)</h4>';
    const outLines = document.createElement('div'); outLines.className='lines';
    const addOut = document.createElement('button'); addOut.type='button'; addOut.textContent='+ Agregar';
    salidas.append(outLines, addOut);

    const wrap = document.createElement('div'); wrap.append(form, ingredientes, salidas);

    const ingRow=()=> {
      const row=document.createElement('div'); row.className='line';
      const mpSel = Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='MP'), required:true});
      const mpFld = Field('MP', mpSel);
      const uomSel = Select({name:'uom_id', items:Store.state.uoms, required:true});
      const uomFld = Field('UOM', uomSel);
      const qty = Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', required:true, value:'1'}));
      row.append(mpFld, uomFld, qty);

      // bloquear UOM a la UOM base del producto
      row.addEventListener('change', (e)=>{
        if (e.target.name === 'producto_id') {
          const pid = Number(e.target.value||0);
          const prod = Store.state.productos.find(p=>p.id===pid);
          if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
          else { uomSel.disabled = false; }
        }
      });

      return row;
    };

    const outRow=()=> {
      const row=document.createElement('div'); row.className='line';
      const ptSel = Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), required:true});
      const uomSel = Select({name:'uom_id', items:Store.state.uoms, required:true});
      row.append(
        Field('PT', ptSel),
        Field('UOM', uomSel),
        Field('Rendimiento', Input({name:'rendimiento', type:'number', step:'0.000001', required:true, value:'1'}))
      );
      row.addEventListener('change', (e)=>{
        if (e.target.name === 'producto_id') {
          const pid = Number(e.target.value||0);
          const prod = Store.state.productos.find(p=>p.id===pid);
          if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
          else { uomSel.disabled = false; }
        }
      });
      return row;
    };

    addIng.onclick=()=> ingLines.appendChild(ingRow());
    addOut.onclick=()=> outLines.appendChild(outRow());

    Modal.open({
      title:'Nueva receta',
      content: wrap,
      onOk: async ()=>{
        const payload = Object.fromEntries(new FormData(form).entries());
        try{
          const rec = await fetchJSON(api('/recetas'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          for (const row of $$('.line', ingLines)) {
            const data = Object.fromEntries($$('select,input', row).map(el=>[el.name, el.value]));
            await fetchJSON(api(`/recetas/${rec.id}/ingredientes`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
          }
          for (const row of $$('.line', outLines)) {
            const data = Object.fromEntries($$('select,input', row).map(el=>[el.name, el.value]));
            await fetchJSON(api(`/recetas/${rec.id}/salidas`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
          }
          Toast('Receta creada','success'); renderList();
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });

    function quickProduct(tipo, selectEl){
      const f = document.createElement('form'); f.className='form-grid';
      f.append(
        Field('Código interno (SKU)', Input({name:'sku', placeholder:'Opcional'})),
        Field('Nombre', Input({name:'nombre', required:true})),
        Field('Tipo', (()=>{ const s=Select({name:'tipo', items:[{id:'MP',nombre:'Materia Prima'},{id:'PT',nombre:'Producto Terminado'}], valueKey:'id', required:true}); s.value=tipo; return s;})()),
        Field('UOM base', Select({name:'uom_base_id', items:Store.state.uoms, valueKey:'id', labelKey:'nombre', required:true}))
      );
      Modal.open({
        title:'Nuevo producto',
        content: f,
        onOk: async ()=>{
          const payload = Object.fromEntries(new FormData(f).entries());
          if (!payload.sku) payload.sku = `${slug(payload.nombre).slice(0,12)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
          payload.uom_base_id = Number(payload.uom_base_id);
          try{
            await fetchJSON(api('/productos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            const productos = await fetchJSON(api('/productos')); Store.set({productos});
            if (selectEl) {
              // refrescar opciones respetando tipo
              selectEl.innerHTML='';
              const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione…'; selectEl.appendChild(ph);
              const filter = tipo==='MP' ? (p)=>p.tipo==='MP' : (p)=>p.tipo==='PT';
              Store.state.productos.filter(filter).forEach(p=>selectEl.appendChild(new Option(p.nombre, p.id)));
              selectEl.value = Store.state.productos.find(p=>p.nombre===payload.nombre)?.id || '';
              selectEl.dispatchEvent(new Event('change'));
            }
            Toast('Producto creado','success');
          }catch(e){ Toast(e.message,'error'); return false; }
        }
      });
    }
  }
});

route('#/produccion', (root)=>{
  const form = document.createElement('form'); form.className='panel form-grid';
  const fecha = Field('Fecha', Input({name:'fecha', type:'date', required:true, value: today()}));
  const receta= Field('Receta', Select({name:'receta_id', items:[], placeholder:'(Ninguna)'}));
  const btn = document.createElement('button'); btn.type='submit'; btn.className='btn-primary'; btn.textContent='Crear tanda';
  const cancel = document.createElement('button'); cancel.type='button'; cancel.className='btn'; cancel.textContent='Cancelar'; cancel.onclick=()=>form.reset();
  const actions = document.createElement('div'); actions.className='form-actions'; actions.append(btn,cancel);
  form.append(fecha, receta, actions);
  root.appendChild(form);

  (async ()=>{
    try{
      const rs = await fetchJSON(api('/recetas'));
      const sl = form.querySelector('select[name="receta_id"]');
      sl.innerHTML='';
      const ph = document.createElement('option'); ph.value=''; ph.textContent='(Ninguna)'; sl.appendChild(ph);
      rs.forEach(r=> sl.appendChild(new Option(r.nombre, r.id)));
    }catch(_){}
  })();

  let tandaId=null;
  const panel=document.createElement('div'); panel.className='panel';
  panel.innerHTML='<h3>Consumos y salidas</h3>';
  const cols=document.createElement('div'); cols.className='grid-2';
  const consumo = document.createElement('div'); consumo.className='subpanel'; consumo.innerHTML='<h4>Consumos (MP)</h4>';
  const salida  = document.createElement('div'); salida.className='subpanel'; salida.innerHTML='<h4>Salidas (PT)</h4>';
  const cLines = document.createElement('div'); cLines.className='lines';
  const sLines = document.createElement('div'); sLines.className='lines';
  const addC = document.createElement('button'); addC.type='button'; addC.textContent='+ Consumo';
  const addS = document.createElement('button'); addS.type='button'; addS.textContent='+ Salida';
  consumo.append(cLines, addC); salida.append(sLines, addS);
  cols.append(consumo, salida); panel.append(cols); root.appendChild(panel);

  // Costeo de Tanda (delegado al backend si existe)
  const costBox = document.createElement('div'); costBox.className='panel';
  costBox.innerHTML = `
    <h3>Costeo de tanda</h3>
    <div id="tandaCostKPI" class="kpi-grid"></div>
    <div id="tandaCostTable"></div>
  `;
  root.appendChild(costBox);

  async function refreshTandaCost(){
    if (!tandaId) return;
    try{
      const data = await fetchJSON(api(`/costeo/tandas/${tandaId}`));
      const kpi = costBox.querySelector('#tandaCostKPI'); kpi.innerHTML='';
      const mk = (t,v)=>{ const c=document.createElement('div'); c.className='card kpi'; c.innerHTML=`<h3>${t}</h3><div class="big">${fmt.money(v)}</div>`; return c; };
      kpi.append(
        mk('Directo', data.costo_directo_crc),
        mk('Indirecto', data.costo_indirecto_crc),
        mk('Total tanda', data.costo_total_crc),
        mk('Unitario real', data.unitario_crc ?? 0)
      );
      const rows = data.consumos || [];
      const tbl = Table({columns:[
        {key:'nombre',label:'MP'},
        {key:'cantidad',label:'Cant.'},
        {key:'costo_unitario_crc',label:'Costo u.',format:fmt.money},
        {key:'costo_total_crc',label:'Costo total',format:fmt.money},
      ], rows});
      const cont = costBox.querySelector('#tandaCostTable'); cont.innerHTML=''; cont.appendChild(tbl);
    }catch(e){ /* silencioso */ }
  }

  // Filas con UOM bloqueada a la base del producto
  const cRow=()=> {
    const row=document.createElement('div'); row.className='line';
    const mpSel = Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='MP'), required:true});
    const mpFld = Field('MP', mpSel);
    const uomSel = Select({name:'uom_id', items:Store.state.uoms, required:true});
    const uomFld = Field('UOM', uomSel);
    row.append(
      mpFld,
      uomFld,
      Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', value:'1', required:true}))
    );
    row.addEventListener('change', (e)=>{
      if (e.target.name === 'producto_id') {
        const pid = Number(e.target.value||0);
        const prod = Store.state.productos.find(p=>p.id===pid);
        if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
        else { uomSel.disabled = false; }
      }
    });
    return row;
  };
  const sRow=()=> {
    const row=document.createElement('div'); row.className='line';
    const ptSel = Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), required:true});
    const uomSel = Select({name:'uom_id', items:Store.state.uoms, required:true});
    row.append(
      Field('PT', ptSel),
      Field('UOM', uomSel),
      Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', value:'1', required:true}))
    );
    row.addEventListener('change', (e)=>{
      if (e.target.name === 'producto_id') {
        const pid = Number(e.target.value||0);
        const prod = Store.state.productos.find(p=>p.id===pid);
        if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
        else { uomSel.disabled = false; }
      }
    });
    return row;
  };

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const payload=Object.fromEntries(new FormData(form).entries());
    try{
      const t=await fetchJSON(api('/produccion/tandas'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      tandaId=t.id; Toast(`Tanda #${tandaId} creada`,'success');

      if (payload.receta_id) {
        try {
          const ings = await fetchJSON(api(`/recetas/${payload.receta_id}/ingredientes`)).catch(()=>[]);
          const outs = await fetchJSON(api(`/recetas/${payload.receta_id}/salidas`)).catch(()=>[]);
          cLines.innerHTML=''; sLines.innerHTML='';
          ings.forEach(i=>{
            const r=cRow();
            r.querySelector('select[name="producto_id"]').value = i.producto_id;
            r.querySelector('select[name="uom_id"]').value = i.uom_id;
            r.querySelector('input[name="cantidad"]').value = i.cantidad;
            cLines.appendChild(r);
          });
          outs.forEach(o=>{
            const r=sRow();
            r.querySelector('select[name="producto_id"]').value = o.producto_id;
            r.querySelector('select[name="uom_id"]').value = o.uom_id;
            r.querySelector('input[name="cantidad"]').value = o.cantidad || o.rendimiento || 1;
            sLines.appendChild(r);
          });
        } catch(_){}
      }
      await refreshTandaCost();
    }catch(e){ Toast(e.message,'error');}
  });

  addC.onclick=()=> { if (!tandaId) return Toast('Primero crea la tanda','error'); cLines.appendChild(cRow()); };
  addS.onclick=()=> { if (!tandaId) return Toast('Primero crea la tanda','error'); sLines.appendChild(sRow()); };

  // Delegación: guarda la fila que cambia
  cLines.addEventListener('change', debounce(async (e)=>{
    if (!tandaId) return;
    const row=e.target.closest('.line'); if(!row) return;
    const data=Object.fromEntries($$('select,input',row).map(el=>[el.name, el.value]));
    try{
      await fetchJSON(api(`/produccion/tandas/${tandaId}/consumos`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      Toast('Consumo guardado','success');
      await refreshTandaCost();
    }catch(err){ Toast(err.message,'error'); }
  }, 400));
  sLines.addEventListener('change', debounce(async (e)=>{
    if (!tandaId) return;
    const row=e.target.closest('.line'); if(!row) return;
    const data=Object.fromEntries($$('select,input',row).map(el=>[el.name, el.value]));
    try{
      await fetchJSON(api(`/produccion/tandas/${tandaId}/salidas`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      Toast('Salida guardada','success');
      await refreshTandaCost();
    }catch(err){ Toast(err.message,'error'); }
  }, 400));
});

route('#/inventario', async (root)=>{
  const bar=Toolbar(
    (()=>{ const b=document.createElement('button'); b.textContent='MP'; b.onclick=()=>load('mp'); return b;})(),
    (()=>{ const b=document.createElement('button'); b.textContent='PT'; b.onclick=()=>load('pt'); return b;})(),
    (()=>{ const b=document.createElement('button'); b.textContent='Resumen'; b.onclick=()=>load('resumen'); return b;})(),
    (()=>{ const b=document.createElement('button'); b.className='btn-primary'; b.textContent='Registrar merma'; b.onclick=()=>openMerma(); return b;})(),
  );
  root.appendChild(bar);
  const cont=document.createElement('div'); root.appendChild(cont);

  async function load(kind){
    cont.innerHTML='Cargando…';
    const data=await fetchJSON(api(`/inventario/${kind}`)).catch(()=>[]);
    const cols = kind==='resumen' ? [
      {key:'sku',label:'Código'},{key:'nombre',label:'Nombre'},{key:'tipo',label:'Tipo'},
      {key:'ultima_entrada',label:'Últ. entrada',format:fmt.date},
      {key:'ultima_salida',label:'Últ. salida',format:fmt.date},
      {key:'existencias_mov',label:'Existencias'}
    ] : [
      {key:'sku',label:'Código'},{key:'nombre',label:'Nombre'},
      {key:'existencias',label:'Existencias'},
      {key: kind==='mp' ? 'total_comprado':'total_producido', label: kind==='mp' ? 'Comprado' : 'Producido'},
      {key: kind==='mp' ? 'total_consumido':'total_vendido', label: kind==='mp' ? 'Consumido':'Vendido'}
    ];
    cont.innerHTML=''; cont.appendChild(Table({columns:cols, rows:data}));
  }
  load('pt');

  function openMerma(){
    const form=document.createElement('form'); form.className='form-grid';
    form.append(
      Field('Fecha', Input({name:'fecha', type:'date', required:true, value: today()})),
      Field('Producto', Select({name:'producto_id', items:Store.state.productos, required:true})),
      Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true})),
      Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', required:true, value:'1'})),
      Field('Ubicación (opcional)', Select({name:'ubicacion_id', items:[], placeholder:'—'})),
      Field('Motivo', Input({name:'motivo'})),
      Field('Nota', Input({name:'nota'}))
    );
    Modal.open({
      title:'Registrar merma',
      content:form,
      onOk: async ()=>{
        const payload=Object.fromEntries(new FormData(form).entries());
        try{
          await fetchJSON(api('/inventario/merma'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          Toast('Merma registrada','success');
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
});

route('#/finanzas', async (root)=>{
  const tabs = document.createElement('div'); tabs.className='tabs';
  tabs.innerHTML = `
    <button class="active" data-t="cuentas">Cuentas</button>
    <button data-t="indirectos">Indirectos</button>
    <span class="spacer"></span>
  `;
  root.appendChild(tabs);

  const cont = document.createElement('div'); root.appendChild(cont);

  async function renderCuentas(){
    cont.innerHTML='';
    const head=document.createElement('div'); head.className='card';
    head.innerHTML = `<b>Saldos por cobrar/pagar</b> · Se calculan desde las facturas de ventas/compras (contado o crédito).`;
    cont.appendChild(head);

    const grid=document.createElement('div'); grid.className='grid-2'; cont.appendChild(grid);
    const [cxc, cxp] = await Promise.all([
      fetchJSON(api('/finanzas/cxc')).catch(()=>[]),
      fetchJSON(api('/finanzas/cxp')).catch(()=>[])
    ]);
    grid.append(
      Table({columns:[
        {key:'venta_id',label:'# Venta'},
        {key:'fecha',label:'Fecha',format:fmt.date},
        {key:'fecha_limite',label:'Vence',format:fmt.date},
        {key:'total_crc',label:'Total',format:fmt.money},
        {key:'cobrado_crc',label:'Cobrado',format:fmt.money},
        {key:'saldo_crc',label:'Saldo',format:fmt.money},
        {key:'dias_vencido',label:'Días venc.'}
      ], rows:cxc}),
      Table({columns:[
        {key:'compra_id',label:'# Compra'},
        {key:'fecha',label:'Fecha',format:fmt.date},
        {key:'fecha_limite',label:'Vence',format:fmt.date},
        {key:'total_crc',label:'Total',format:fmt.money},
        {key:'pagado_crc',label:'Pagado',format:fmt.money},
        {key:'saldo_crc',label:'Saldo',format:fmt.money},
        {key:'dias_vencido',label:'Días venc.'}
      ], rows:cxp})
    );
  }

  async function renderIndirectos(){
    cont.innerHTML='';
    const wrap = document.createElement('div'); wrap.className='grid-2'; cont.appendChild(wrap);

    // Config % global
    const cfgCard = document.createElement('div'); cfgCard.className='card';
    cfgCard.innerHTML = `
      <h3>Configuración de indirectos</h3>
      <div class="form-grid">
        <label class="field"><span>Método</span>
          <select id="indMethod">
            <option value="PORCENTAJE_GLOBAL">Porcentaje global sobre costo directo</option>
          </select>
        </label>
        <label class="field"><span>% Global</span>
          <input id="indPct" type="number" step="0.01" placeholder="18 = 18%">
        </label>
        <div class="form-actions">
          <button id="btnSaveCfg" class="btn-primary">Guardar</button>
        </div>
      </div>
      <small class="muted">Este % se puede sobreescribir al costear una receta o tanda.</small>
    `;
    wrap.appendChild(cfgCard);

    // CRUD partidas indirectas
    const crud = document.createElement('div'); crud.className='card';
    crud.innerHTML = `
      <h3>Partidas de costos indirectos (mensuales)</h3>
      <form id="formIndirecto" class="form-grid">
        <label class="field"><span>Nombre</span><input name="nombre" required placeholder="Alquiler, Luz, Limpieza…"></label>
        <label class="field"><span>Monto mensual (CRC)</span><input name="monto_mensual_crc" type="number" step="0.01" required></label>
        <label class="field"><span>Activo</span>
          <select name="activo"><option value="1">Sí</option><option value="0">No</option></select>
        </label>
        <div class="form-actions">
          <button class="btn-primary" type="submit">Agregar</button>
        </div>
      </form>
      <div id="indList" style="margin-top:10px"></div>
    `;
    wrap.appendChild(crud);

    // cargar config
    let cfg = await fetchJSON(api('/finanzas/config/indirectos')).catch(()=>({method:'PORCENTAJE_GLOBAL', pct:0}));
    $('#indMethod', cfgCard).value = cfg.method || 'PORCENTAJE_GLOBAL';
    $('#indPct', cfgCard).value = (Number(cfg.pct||0)*100).toFixed(2);

    $('#btnSaveCfg', cfgCard).onclick = async ()=>{
      const body = { method: $('#indMethod', cfgCard).value, pct: Number($('#indPct', cfgCard).value||0)/100 };
      try{
        await fetchJSON(api('/finanzas/config/indirectos'), {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
        Toast('Configuración guardada','success');
      }catch(e){ Toast(e.message,'error'); }
    };

    // listar partidas
    async function loadList(){
      const items = await fetchJSON(api('/finanzas/indirectos')).catch(()=>[]);
      const box = $('#indList', crud); box.innerHTML='';
      box.appendChild(Table({columns:[
        {key:'nombre',label:'Nombre'},
        {key:'monto_mensual_crc',label:'Monto',format:fmt.money},
        {key:'activo',label:'Activo'},
      ], rows:items}));
    }
    await loadList();

    // alta
    $('#formIndirecto', crud).addEventListener('submit', async (e)=>{
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      payload.monto_mensual_crc = Number(payload.monto_mensual_crc||0);
      payload.activo = Number(payload.activo||1);
      try{
        await fetchJSON(api('/finanzas/indirectos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        e.target.reset();
        await loadList();
        Toast('Partida creada','success');
      }catch(err){ Toast(err.message,'error'); }
    });
  }

  function switchTab(kind){
    tabs.querySelectorAll('button[data-t]').forEach(b=>b.classList.toggle('active', b.dataset.t===kind));
    if (kind==='indirectos') renderIndirectos(); else renderCuentas();
  }

  tabs.addEventListener('click', (e)=>{
    if (e.target.matches('[data-t]')) switchTab(e.target.dataset.t);
  });

  switchTab('cuentas');
});

/* ---------- PLANILLAS (diario -> vista semanal) ---------- */
route('#/planillas', async (root) => {
  // Panel superior: crear planilla y filtros
  const top = document.createElement('div'); top.className = 'panel';
  top.innerHTML = `
    <h3>Planillas (semanales)</h3>
    <div class="form-grid">
      <label class="field">
        <span>Semana (inicio)</span>
        <input name="semana_inicio" type="date" required>
      </label>
      <label class="field">
        <span>Nota</span>
        <input name="nota" placeholder="Opcional">
      </label>
      <div class="form-actions">
        <button id="btnNuevaPlanilla" class="btn-primary">Crear planilla</button>
      </div>
    </div>
    <div class="subpanel" style="margin-top:8px">
      <h4>Buscar por mes</h4>
      <div class="form-grid">
        <label class="field"><span>Mes (YYYY-MM)</span><input name="f_mes" placeholder="2025-03"></label>
        <div class="form-actions"><button id="btnFiltrar" class="btn">Filtrar</button></div>
      </div>
    </div>
  `;
  root.appendChild(top);

  const listWrap = document.createElement('div'); listWrap.className = 'panel'; root.appendChild(listWrap);
  const detailWrap = document.createElement('div'); detailWrap.className = 'panel'; root.appendChild(detailWrap);

  async function loadList(mes=null){
    const qs = mes ? `?mes=${encodeURIComponent(mes)}` : '';
    const rows = await fetchJSON(api(`/planillas${qs}`)).catch(()=>[]);
    listWrap.innerHTML = '';
    const tbl = Table({
      columns: [
        {key:'id', label:'#'},
        {key:'semana_inicio', label:'Semana', format: fmt.date},
        {key:'nota', label:'Nota'}
      ],
      rows
    });
    listWrap.appendChild(tbl);
    listWrap.querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.style.cursor='pointer';
      tr.onclick=()=> openPlanilla(rows[i].id);
    });
  }

  async function createPlanilla(){
    const semana_inicio = top.querySelector('input[name="semana_inicio"]').value;
    const nota = top.querySelector('input[name="nota"]').value || null;
    if (!semana_inicio) return Toast('Elegí la fecha de inicio de semana','error');
    try{
      const res = await fetchJSON(api('/planillas'), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({semana_inicio, nota})
      });
      Toast(`Planilla #${res.id} creada`, 'success');
      await loadList(top.querySelector('input[name="f_mes"]').value || null);
      await openPlanilla(res.id);
    }catch(e){ Toast(e.message, 'error'); }
  }

  $('#btnNuevaPlanilla', top).onclick = createPlanilla;
  $('#btnFiltrar', top).onclick = async ()=>{
    await loadList(top.querySelector('input[name="f_mes"]').value || null);
    detailWrap.innerHTML='';
  };

  await loadList();

  // ---------- Detalle de una planilla ----------
  async function openPlanilla(id){
    const data = await fetchJSON(api(`/planillas/${id}`)).catch(()=>null);
    if (!data) return Toast('No se pudo cargar la planilla', 'error');

    detailWrap.innerHTML = `
      <h3>Planilla #${id} · Semana que inicia ${fmt.date(data.semana_inicio)}</h3>
      <div class="form-grid" style="margin-bottom:8px">
        <label class="field"><span>Empleado</span>
          <select name="emp_sel"></select>
        </label>
        <label class="field"><span>Tarifa hora (CRC)</span>
          <input name="tarifa" type="number" step="0.01" value="0">
        </label>
        <label class="field"><span>Rol</span>
          <input name="rol" placeholder="Operario, Producción…">
        </label>
        <div class="form-actions">
          <button id="btnAddEmp" class="btn">Agregar a planilla</button>
        </div>
      </div>

      <div class="subpanel">
        <h4>Factores de cálculo (vista)</h4>
        <div class="form-grid">
          <label class="field"><span>Factor extra</span><input name="fx" type="number" step="0.1" value="1.5"></label>
          <label class="field"><span>Factor dobles</span><input name="fd" type="number" step="0.1" value="2.0"></label>
          <label class="field"><span>Factor feriado</span><input name="ff" type="number" step="0.1" value="2.0"></label>
        </div>
      </div>

      <div id="detTabla"></div>
      <div id="resumenSemanal" style="margin-top:12px"></div>
    `;

    // cargar empleados al select
    const sel = detailWrap.querySelector('select[name="emp_sel"]');
    sel.innerHTML = '<option value="">Seleccione…</option>';
    Store.state.empleados.forEach(e => sel.appendChild(new Option(e.nombre, e.id)));

    $('#btnAddEmp', detailWrap).onclick = async ()=>{
      const empleado_id = Number(sel.value || 0) || null;
      const tarifa = Number(detailWrap.querySelector('input[name="tarifa"]').value||0);
      const rol = detailWrap.querySelector('input[name="rol"]').value || null;
      if (!empleado_id && !rol) return Toast('Elija empleado o escriba persona/rol', 'error');
      try{
        await fetchJSON(api(`/planillas/${id}/detalles`), {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({empleado_id, tarifa_hora_crc: tarifa, rol})
        });
        Toast('Empleado agregado', 'success');
        await openPlanilla(id);
      }catch(e){ Toast(e.message,'error'); }
    };

    renderDetalles(id, data);
  }

  function renderDetalles(id, data){
    const fx = Number(detailWrap.querySelector('input[name="fx"]').value||1.5);
    const fd = Number(detailWrap.querySelector('input[name="fd"]').value||2.0);
    const ff = Number(detailWrap.querySelector('input[name="ff"]').value||2.0);

    // Tabla de empleados con botón "Editar diario"
    const rows = (data.detalles||[]).map(d => {
      const z = d.resumen || {};
      const tarifa = Number(d.tarifa_hora_crc||0);
      const subtotal = tarifa * Number(z.reg||0); // salario base (solo horas reg)
      const diasTrab = Number(z.dias_trab||0);
      const salarioDiarioProm = diasTrab ? (subtotal / diasTrab) : 0;

      // extras
      const hExt = Number(z.ext||0);
      const pxExt = tarifa * fx;
      const totExt = hExt * pxExt;

      // feriados
      const ferDias = Number(z.feriados||0);
      const hFeriado = Number(z.horas_feriado||0);
      const totFeriados = hFeriado * tarifa * ff;

      // dobles
      const hDob = Number(z.dob||0);
      const pxDob = tarifa * fd;
      const totDob = hDob * pxDob;

      const bruto = subtotal + totExt + totFeriados + totDob;

      return {
        det_id: d.id,
        empleado: d.empleado_nombre || d.persona || '—',
        rol: d.rol || '—',
        tarifa,
        diasTrab,
        salarioDiarioProm,
        subtotal,
        hExt, pxExt, totExt,
        ferDias, hFeriado, totFeriados,
        hDob, pxDob, totDob,
        bruto,
        raw: d
      };
    });

    const cont = $('#detTabla', detailWrap); cont.innerHTML='';
    const wrap = document.createElement('div'); wrap.className='table-wrap';
    const table = document.createElement('table'); table.className='table';
    table.innerHTML = `
      <thead><tr>
        <th>Empleado</th><th>Rol</th><th>Tarifa</th>
        <th>Días trab.</th><th>Salario diario</th><th>Subtotal (base)</th>
        <th>HE (h)</th><th>₡/h extra</th><th>Total extras</th>
        <th># feriados</th><th>h feriado</th><th>Total feriados</th>
        <th>HD (h)</th><th>₡/h doble</th><th>Total dobles</th>
        <th>SALARIO BRUTO</th>
        <th></th>
      </tr></thead>
      <tbody></tbody>
    `;
    rows.forEach(r => {
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td>${r.empleado}</td>
        <td>${r.rol}</td>
        <td>${fmt.money(r.tarifa)}</td>
        <td>${r.diasTrab}</td>
        <td>${fmt.money(r.salarioDiarioProm)}</td>
        <td>${fmt.money(r.subtotal)}</td>
        <td>${r.hExt}</td>
        <td>${fmt.money(r.pxExt)}</td>
        <td>${fmt.money(r.totExt)}</td>
        <td>${r.ferDias}</td>
        <td>${r.hFeriado}</td>
        <td>${fmt.money(r.totFeriados)}</td>
        <td>${r.hDob}</td>
        <td>${fmt.money(r.pxDob)}</td>
        <td>${fmt.money(r.totDob)}</td>
        <td><b>${fmt.money(r.bruto)}</b></td>
        <td><button class="btn" data-edit="${r.det_id}">Editar diario</button></td>
      `;
      table.querySelector('tbody').appendChild(tr);
    });
    wrap.appendChild(table); cont.appendChild(wrap);

    // Resumen semanal (totales de toda la planilla)
    const R = rows.reduce((acc, r) => {
      acc.subtotal += r.subtotal;
      acc.totExt  += r.totExt;
      acc.totFeri += r.totFeriados;
      acc.totDob  += r.totDob;
      acc.bruto   += r.bruto;
      return acc;
    }, {subtotal:0, totExt:0, totFeri:0, totDob:0, bruto:0});
    const res = $('#resumenSemanal', detailWrap);
    res.innerHTML = `
      <div class="kpi-grid">
        <div class="card kpi"><h3>Subtotal base</h3><div class="big">${fmt.money(R.subtotal)}</div></div>
        <div class="card kpi"><h3>Extras</h3><div class="big">${fmt.money(R.totExt)}</div></div>
        <div class="card kpi"><h3>Feriados</h3><div class="big">${fmt.money(R.totFeri)}</div></div>
        <div class="card kpi"><h3>Dobles</h3><div class="big">${fmt.money(R.totDob)}</div></div>
        <div class="card kpi"><h3>SALARIO BRUTO</h3><div class="big">${fmt.money(R.bruto)}</div></div>
      </div>
    `;

    // Handlers
    table.addEventListener('click', (e)=>{
      const idbtn = e.target?.getAttribute?.('data-edit');
      if (!idbtn) return;
      const det = rows.find(x=> String(x.det_id)===String(idbtn))?.raw;
      if (det) openHorasModal(id, data.semana_inicio, det);
    });

    // Recalcular cuando cambian factores
    detailWrap.querySelectorAll('input[name="fx"], input[name="fd"], input[name="ff"]').forEach(inp=>{
      inp.addEventListener('input', ()=> renderDetalles(id, data));
    });
  }

  function openHorasModal(planillaId, semanaInicio, det){
    const start = new Date(semanaInicio);
    const diasBase = [...Array(7)].map((_,i)=>{
      const d = new Date(start); d.setDate(d.getDate()+i);
      const key = d.toISOString().slice(0,10);
      const base = det.dias?.[key] || {horas_reg:0, horas_extra:0, horas_doble:0, feriado:false, horas_feriado:0};
      return {fecha:key, ...base};
    });

    const form = document.createElement('form'); form.className='form-grid';
    const grid = document.createElement('div'); grid.className='table-wrap';
    const tbl = document.createElement('table'); tbl.className='table';
    tbl.innerHTML = `
      <thead><tr><th>Día</th><th>Normales</th><th>Extra</th><th>Dobles</th><th>Feriado</th><th>h Feriado</th></tr></thead>
      <tbody></tbody>
    `;
    diasBase.forEach(d=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${d.fecha}</td>
        <td><input name="reg-${d.fecha}" type="number" step="0.01" value="${d.horas_reg}"></td>
        <td><input name="ext-${d.fecha}" type="number" step="0.01" value="${d.horas_extra}"></td>
        <td><input name="dob-${d.fecha}" type="number" step="0.01" value="${d.horas_doble}"></td>
        <td style="text-align:center"><input name="fer-${d.fecha}" type="checkbox" ${d.feriado?'checked':''}></td>
        <td><input name="hfer-${d.fecha}" type="number" step="0.01" value="${d.horas_feriado}"></td>
      `;
      tbl.querySelector('tbody').appendChild(tr);
    });
    grid.appendChild(tbl);

    form.append(grid);

    Modal.open({
      title: `Editar diario · ${det.empleado_nombre || det.persona || ''}`,
      content: form,
      onOk: async ()=>{
        const payload = {
          dias: diasBase.map(d => ({
            fecha: d.fecha,
            horas_reg: Number(form.querySelector(`input[name="reg-${d.fecha}"]`).value||0),
            horas_extra: Number(form.querySelector(`input[name="ext-${d.fecha}"]`).value||0),
            horas_doble: Number(form.querySelector(`input[name="dob-${d.fecha}"]`).value||0),
            feriado: !!form.querySelector(`input[name="fer-${d.fecha}"]`).checked,
            horas_feriado: Number(form.querySelector(`input[name="hfer-${d.fecha}"]`).value||0),
          }))
        };
        try{
          await fetchJSON(api(`/planillas/${planillaId}/detalles/${det.id}/dias`), {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });
          Toast('Horas diarias guardadas','success');
          // recargar detalle
          const data = await fetchJSON(api(`/planillas/${planillaId}`));
          renderDetalles(planillaId, data);
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
});

// Búsqueda global (defensiva)
const searchBtn = $('#searchBtn');
if (searchBtn) searchBtn.onclick = ()=> doSearch();
const globalSearch = $('#globalSearch');
if (globalSearch) globalSearch.addEventListener('keydown', e=>{ if (e.key==='Enter') doSearch(); });
function cardList(title, data, keys){
  const card=document.createElement('div'); card.className='card';
  card.innerHTML = `<h3>${title}</h3>`;
  const ul=document.createElement('ul'); ul.className='list';
  data.slice(0,12).forEach(r=>{
    const li=document.createElement('li'); li.innerHTML = keys.map(k=>`<span>${(r[k]??'')}</span>`).join(' · '); ul.appendChild(li);
  });
  if (!data.length) ul.innerHTML = '<li class="muted">Sin resultados</li>';
  card.appendChild(ul); return card;
}
async function doSearch(){
  const q = $('#globalSearch')?.value?.trim().toLowerCase();
  if (!q) return;
  const prods = Store.state.productos.filter(p=> (p.nombre||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q));
  const clis  = Store.state.clientes.filter(c=> (c.nombre||'').toLowerCase().includes(q));
  const provs = Store.state.proveedores.filter(p=> (p.nombre||'').toLowerCase().includes(q));
  const view = $('#view'); if (!view) return;
  view.innerHTML='';
  const grid = document.createElement('div'); grid.className='grid-3';
  grid.append(
    cardList('Productos', prods, ['sku','nombre','tipo']),
    cardList('Clientes', clis, ['nombre','telefono','email']),
    cardList('Proveedores', provs, ['nombre','telefono','email'])
  );
  view.appendChild(grid);
}

// Tema
const themeToggle = $('#themeToggle');
if (themeToggle) themeToggle.onclick = ()=>{
  const root = document.documentElement;
  root.classList.toggle('dark'); root.classList.toggle('light');
  localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
};
if (localStorage.getItem('theme')==='dark') { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); }

// Navegación
window.addEventListener('hashchange', ()=>navigate(location.hash));
navigate(location.hash || '#/dashboard');

// Re-render on catalogs update
Store.subscribe(()=> {
  const h=location.hash;
  if (['#/ventas','#/compras','#/productos','#/contactos','#/recetas','#/produccion','#/planillas'].includes(h)) navigate(h);
});

// Quick create -> ir a ventas
const quick = $('#quickCreateBtn');
if (quick) quick.onclick = () => { location.hash = '#/ventas'; };
