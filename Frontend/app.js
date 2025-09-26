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

  const safeClose = (e) => { e?.preventDefault?.(); dlg.close(); };

  primary.addEventListener('click', (e) => {
    if (onOk) {
      e.preventDefault();
      Promise.resolve(onOk()).then(ok => {
        if (ok !== false) dlg.close();
      }).catch(err => Toast(err?.message || 'Error', 'error'));
    }
  });
  btnCancel.addEventListener('click', safeClose);
  btnCloseX.addEventListener('click', safeClose);
  dlg.addEventListener('cancel', safeClose); // ESC
  dlg.addEventListener('close', () => { body.innerHTML=''; onOk=null; });

  return {
    open({title: t, content, onOk: cb, okText='Guardar'}) {
      title.textContent = t;
      body.innerHTML = '';
      body.appendChild(content);
      primary.textContent = okText;
      onOk = cb;
      dlg.showModal();
    },
    close(){ dlg.close(); }
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
  const view = $('#view'); view.innerHTML='';
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
  const btn = document.createElement('button'); btn.className='btn-primary'; btn.textContent='Crear venta';
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

  lines.addEventListener('change', debounce(async ()=>{
    if (!ventaId) return;
    const last = lines.lastElementChild; if(!last) return;
    const data = Object.fromEntries($$('select,input', last).map(el=>[el.name, el.value]));
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
  const btn   = document.createElement('button'); btn.className='btn-primary'; btn.textContent='Crear compra';
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
    const prodWrap = Field('Producto (MP)', Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='MP'), required:true}));
    const addMP = document.createElement('button'); addMP.type='button'; addMP.className='icon-btn'; addMP.textContent='＋'; addMP.title='Nuevo MP';
    addMP.onclick=()=>quickProduct('MP', prodWrap.querySelector('select'));
    prodWrap.appendChild(addMP);

    const uom  = Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true}));
    const cant = Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', value:'1', required:true}));
    const costo= Field('Costo', Input({name:'costo_unitario_crc', type:'number', step:'0.01', value:'0', required:true}));
    const desc = Field('Desc', Input({name:'descuento_crc', type:'number', step:'0.01', value:'0'}));
    const del  = document.createElement('button'); del.type='button'; del.className='icon-btn'; del.textContent='🗑'; del.onclick=()=>{ row.remove(); calc(); };
    row.append(prodWrap, uom, cant, costo, desc, del);
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

  lines.addEventListener('change', debounce(async ()=>{
    if (!compraId) return;
    const last=lines.lastElementChild; if(!last) return;
    const data=Object.fromEntries($$('select,input',last).map(el=>[el.name, el.value]));
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

  // Panel de Costeo de receta
  const costPanel = document.createElement('div'); costPanel.className='panel';
  costPanel.innerHTML = `
    <h3>Costeo de receta</h3>
    <div class="form-grid">
      <label class="field"><span>Receta</span><select name="receta_sel"></select></label>
      <label class="field"><span>Rendimiento (opcional)</span><input name="rend" type="number" step="0.000001" placeholder="Si vacío, usa salidas de la receta"></label>
      <div class="form-actions">
        <button id="btnCostearReceta" class="btn-primary">Calcular</button>
      </div>
    </div>
    <div id="recetaCostKPI" class="kpi-grid" style="margin-top:10px"></div>
    <div id="recetaCostTable"></div>
  `;
  root.appendChild(costPanel);

  (async ()=>{
    const recetas = await fetchJSON(api('/recetas')).catch(()=>[]);
    const sel = costPanel.querySelector('select[name="receta_sel"]');
    sel.innerHTML = '<option value="">Seleccione…</option>';
    recetas.forEach(r => sel.appendChild(new Option(r.nombre, r.id)));
  })();

  costPanel.querySelector('#btnCostearReceta').onclick = async ()=>{
    const rid = Number(costPanel.querySelector('select[name="receta_sel"]').value || 0);
    if (!rid) return Toast('Elegí una receta','error');
    const rend = costPanel.querySelector('input[name="rend"]').value;
    const q = rend ? `?rendimiento=${encodeURIComponent(rend)}` : '';
    try{
      const data = await fetchJSON(api(`/costeo/recetas/${rid}${q}`));
      const kpi = costPanel.querySelector('#recetaCostKPI'); kpi.innerHTML='';
      const mk = (t,v)=>{ const c=document.createElement('div'); c.className='card kpi'; c.innerHTML=`<h3>${t}</h3><div class="big">${fmt.money(v)}</div>`; return c; };
      kpi.append(
        mk('Directo', data.costo_directo_crc),
        mk('Indirecto asignado', data.costo_indirecto_asignado_crc),
        mk('Total receta', data.costo_total_crc),
        mk('Unitario estimado', data.unitario_crc ?? 0)
      );
      costPanel.querySelector('#recetaCostTable').innerHTML = '';
      costPanel.querySelector('#recetaCostTable').appendChild(
        Table({columns:[
          {key:'nombre',label:'Ingrediente'},
          {key:'cantidad',label:'Cant.'},
          {key:'costo_unitario_crc',label:'Costo u.',format:fmt.money},
          {key:'costo_total_crc',label:'Costo total',format:fmt.money}
        ], rows: data.ingredientes})
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
      const mpSel = Field('MP', Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='MP'), required:true}));
      const plus = document.createElement('button'); plus.type='button'; plus.className='icon-btn'; plus.textContent='＋'; plus.title='Nuevo MP'; plus.onclick=()=>quickProduct('MP', mpSel.querySelector('select'));
      mpSel.appendChild(plus);
      row.append(
        mpSel,
        Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true})),
        Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', required:true, value:'1'}))
      );
      return row;
    };
    const outRow=()=> {
      const row=document.createElement('div'); row.className='line';
      row.append(
        Field('PT', Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), required:true})),
        Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true})),
        Field('Rendimiento', Input({name:'rendimiento', type:'number', step:'0.000001', required:true, value:'1'}))
      );
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
          Toast('Receta creada','success');
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
              selectEl.innerHTML='';
              const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione…'; selectEl.appendChild(ph);
              const filter = tipo==='MP' ? (p)=>p.tipo==='MP' : (p)=>p.tipo==='PT';
              Store.state.productos.filter(filter).forEach(p=>selectEl.appendChild(new Option(p.nombre, p.id)));
              selectEl.value = Store.state.productos.find(p=>p.nombre===payload.nombre)?.id || '';
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
  const btn = document.createElement('button'); btn.className='btn-primary'; btn.textContent='Crear tanda';
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

  // Costeo de Tanda
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
    }catch(e){ /* silencioso hasta que haya líneas */ }
  }

  const cRow=()=> {
    const row=document.createElement('div'); row.className='line';
    const mpSel = Field('MP', Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='MP'), required:true}));
    const plus = document.createElement('button'); plus.type='button'; plus.className='icon-btn'; plus.textContent='＋'; plus.title='Nuevo MP'; plus.onclick=()=>quickProduct('MP', mpSel.querySelector('select'));
    mpSel.appendChild(plus);
    row.append(
      mpSel,
      Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true})),
      Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', value:'1', required:true}))
    ); return row;
  };
  const sRow=()=> {
    const row=document.createElement('div'); row.className='line';
    row.append(
      Field('PT', Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), required:true})),
      Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true})),
      Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', value:'1', required:true}))
    ); return row;
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

  cLines.addEventListener('change', debounce(async ()=>{
    if (!tandaId) return;
    const row=cLines.lastElementChild; if(!row) return;
    const data=Object.fromEntries($$('select,input',row).map(el=>[el.name, el.value]));
    try{
      await fetchJSON(api(`/produccion/tandas/${tandaId}/consumos`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      Toast('Consumo guardado','success');
      await refreshTandaCost();
    }catch(e){ Toast(e.message,'error'); }
  }, 400));
  sLines.addEventListener('change', debounce(async ()=>{
    if (!tandaId) return;
    const row=sLines.lastElementChild; if(!row) return;
    const data=Object.fromEntries($$('select,input',row).map(el=>[el.name, el.value]));
    try{
      await fetchJSON(api(`/produccion/tandas/${tandaId}/salidas`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      Toast('Salida guardada','success');
      await refreshTandaCost();
    }catch(e){ Toast(e.message,'error'); }
  }, 400));

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
            selectEl.innerHTML='';
            const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione…'; selectEl.appendChild(ph);
            const filter = tipo==='MP' ? (p)=>p.tipo==='MP' : (p)=>p.tipo==='PT';
            Store.state.productos.filter(filter).forEach(p=>selectEl.appendChild(new Option(p.nombre, p.id)));
            selectEl.value = Store.state.productos.find(p=>p.nombre===payload.nombre)?.id || '';
          }
          Toast('Producto creado','success');
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
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
  const head=document.createElement('div'); head.className='panel';
  head.innerHTML = `<b>Saldos por cobrar/pagar</b> · Se calculan <i>desde</i> las facturas de ventas/compras (contado o crédito). No duplica registros.`;
  root.appendChild(head);

  const cont=document.createElement('div'); cont.className='grid-2'; root.appendChild(cont);
  const cxc = await fetchJSON(api('/finanzas/cxc')).catch(()=>[]);
  const cxp = await fetchJSON(api('/finanzas/cxp')).catch(()=>[]);
  cont.append(
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
});

// Búsqueda global
$('#searchBtn').onclick = ()=> doSearch();
$('#globalSearch').addEventListener('keydown', e=>{ if (e.key==='Enter') doSearch(); });
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
  const q = $('#globalSearch').value.trim().toLowerCase();
  if (!q) return;
  const prods = Store.state.productos.filter(p=> (p.nombre||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q));
  const clis  = Store.state.clientes.filter(c=> (c.nombre||'').toLowerCase().includes(q));
  const provs = Store.state.proveedores.filter(p=> (p.nombre||'').toLowerCase().includes(q));
  const view = $('#view'); view.innerHTML='';
  const grid = document.createElement('div'); grid.className='grid-3';
  grid.append(
    cardList('Productos', prods, ['sku','nombre','tipo']),
    cardList('Clientes', clis, ['nombre','telefono','email']),
    cardList('Proveedores', provs, ['nombre','telefono','email'])
  );
  view.appendChild(grid);
}

// Tema
$('#themeToggle').onclick = ()=>{
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
  if (['#/ventas','#/compras','#/productos','#/contactos','#/recetas','#/produccion'].includes(h)) navigate(h);
});

// Quick create -> ir a ventas
const quick = $('#quickCreateBtn');
if (quick) quick.onclick = () => { location.hash = '#/ventas'; };
