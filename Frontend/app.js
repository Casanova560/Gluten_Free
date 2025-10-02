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

// === Helper de costos MP (por unidad base) ===
async function getCostosMP(ids=[]) {
  if (!ids.length) return {};
  try {
    const res = await fetchJSON(api(`/costos/mp?ids=${ids.join(',')}`));
    const out = {};
    Object.entries(res||{}).forEach(([k,v])=>{
      out[k] = typeof v === 'number' ? v : Number(v?.costo_unitario_crc||0);
    });
    return out;
  } catch {
    return {};
  }
}

// === Helper costo unitario de PT (por receta o costo estándar) ===
async function getCostoUnitarioPT(productoId) {
  try {
    // 1) Buscar receta cuyo producto de salida sea este PT
    const recetas = await fetchJSON(api('/recetas')).catch(()=>[]);
    const rec = (recetas||[]).find(r => Number(r.producto_salida_id)===Number(productoId));
    if (rec) {
      const res = await fetchJSON(api(`/costeo/recetas/${rec.id}`)).catch(()=>null);
      const unit = Number(res?.unitario_crc||0);
      if (unit>0) return unit;
    }
    // 2) Fallback: usar costo_estandar_crc del producto
    const prod = Store.state.productos.find(p=> Number(p.id)===Number(productoId));
    if (prod && Number(prod.costo_estandar_crc||0)>0) return Number(prod.costo_estandar_crc);
  } catch {}
  return 0;
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

function handleProductCreated(product, { openRecipe = false } = {}) {
  if (!product || product.tipo !== 'PT' || !openRecipe) return;
  try {
    const payload = { id: product.id, nombre: product.nombre };
    sessionStorage.setItem('pendingRecipeProduct', JSON.stringify(payload));
    if (location.hash === '#/recetas') {
      window.dispatchEvent(new CustomEvent('recipe-pending-ready'));
    } else {
      location.hash = '#/recetas';
    }
  } catch (err) {
    console.warn('No se pudo preparar la receta pendiente', err);
  }
}


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
      const raw = c.key != null ? r[c.key] : undefined;
      if (typeof c.render === 'function') {
        const result = c.render(r, raw);
        if (result == null) {
          td.textContent = '';
        } else if (result instanceof Node) {
          td.appendChild(result);
        } else if (Array.isArray(result)) {
          result.forEach(node => {
            if (node instanceof Node) {
              td.appendChild(node);
            } else if (node != null) {
              td.append(document.createTextNode(String(node)));
            }
          });
        } else {
          td.textContent = String(result);
        }
      } else {
        const formatted = c.format ? c.format(raw, r) : raw;
        if (formatted instanceof Node) {
          td.appendChild(formatted);
        } else if (Array.isArray(formatted)) {
          formatted.forEach(node => {
            if (node instanceof Node) {
              td.appendChild(node);
            } else if (node != null) {
              td.append(document.createTextNode(String(node)));
            }
          });
        } else {
          td.textContent = formatted == null ? '' : String(formatted);
        }
      }
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

route('#/dashboard', (root) => {
  const tryRender = () => {
    if (typeof window.renderDashboard === 'function') {
      window.renderDashboard(root);
      return true;
    }
    return false;
  };

  if (tryRender()) return;

  root.innerHTML = '<div class="card"><h3>Dashboard</h3><p class="muted">Cargando dashboard...</p></div>';

  const onReady = () => {
    if (location.hash !== '#/dashboard') return;
    if (tryRender()) {
      window.removeEventListener('dashboard-ready', onReady);
    }
  };

  window.addEventListener('dashboard-ready', onReady);
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
  let currentQuery = '';
  const btnGroup = document.createElement('div');
  btnGroup.className = 'btn-group';
  const btnNewMP = document.createElement('button');
  btnNewMP.className = 'btn-primary';
  btnNewMP.textContent = 'Nueva MP';
  btnNewMP.onclick = () => openProductoModal({ tipo: 'MP' });
  const btnNewPT = document.createElement('button');
  btnNewPT.className = 'btn';
  btnNewPT.textContent = 'Nuevo PT (receta)';
  btnNewPT.onclick = () => {
    sessionStorage.removeItem('pendingProductModal');
    sessionStorage.setItem('pendingRecipeModal', JSON.stringify({ createPT: true }));
    if (location.hash === '#/recetas') {
      window.dispatchEvent(new CustomEvent('recipe-pending-ready'));
    } else {
      location.hash = '#/recetas';
    }
  };
  btnGroup.append(btnNewMP, btnNewPT);
  const searchInput = Input({name:'q',placeholder:'Buscar...'});
  searchInput.addEventListener('input', debounce(() => {
    currentQuery = searchInput.value || '';
    renderList(currentQuery);
  }, 250));
  const header = Toolbar(btnGroup, searchInput);
  root.appendChild(header);

  async function refreshProductos() {
    try {
      const productos = await fetchJSON(api('/productos'));
      if (Array.isArray(productos)) {
        Store.set({ productos });
      }
    } catch (err) {
      console.error(err);
      Toast('No se pudieron refrescar los productos', 'error');
    }
  }

  function renderList(q = '') {
    currentQuery = q || '';
    const rows = Store.state.productos.filter(p => {
      if (!currentQuery) return true;
      const needle = currentQuery.toLowerCase();
      return (p.nombre || '').toLowerCase().includes(needle) || (p.sku || '').toLowerCase().includes(needle);
    });
    root.querySelector('.table-wrap')?.remove();
    const actionsCol = {
      key: 'id',
      label: 'Acciones',
      render: (row) => {
        const wrap = document.createElement('div');
        wrap.className = 'table-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'icon-btn';
        editBtn.textContent = 'Editar';
        editBtn.title = 'Editar';
        editBtn.onclick = () => openProductoModal(row, { mode: 'edit' });
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'icon-btn';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.title = 'Eliminar';
        deleteBtn.onclick = async () => {
          if (!confirm(`Eliminar producto ${row.nombre}?`)) return;
          try {
            await fetchJSON(api(`/productos/${row.id}`), { method: 'DELETE' });
            Toast('Producto eliminado', 'success');
            await refreshProductos();
            renderList(currentQuery);
          } catch (err) {
            Toast(err?.message || 'No se pudo eliminar el producto', 'error');
          }
        };
        wrap.append(editBtn, deleteBtn);
        return wrap;
      }
    };
    root.appendChild(Table({
      columns:[
        {key:'sku',label:'Código'},
        {key:'nombre',label:'Nombre'},
        {key:'tipo',label:'Tipo'},
        {key:'uom_base_id',label:'UOM'},
        {key:'precio_venta_crc',label:'Precio venta',format:fmt.money},
        {key:'costo_estandar_crc',label:'Costo estándar',format:fmt.money},
        {key:'activo',label:'Activo'},
        actionsCol
      ],
      rows
    }));
  }
  renderList();

  function openProductoModal(prefill = { tipo: 'MP' }, { mode = 'create' } = {}) {
    const isEdit = mode === 'edit' && prefill && prefill.id;
    const form = document.createElement('form'); form.className='form-grid';
    const sku = Field('Código interno (SKU)', Input({name:'sku', placeholder:'Opcional', value: prefill.sku || ''}), {hint:'Si se deja vacío, se autogenera'});
    const nom = Field('Nombre', Input({name:'nombre', required:true, value: prefill.nombre || ''}));
    const tipoSel = Select({name:'tipo',items:[{id:'MP',nombre:'Materia Prima'},{id:'PT',nombre:'Producto Terminado'}], valueKey:'id'});
    tipoSel.required = true; tipoSel.value = prefill.tipo || 'MP';
    const tipo = Field('Tipo', tipoSel);
    const uom = Field('UOM base', Select({name:'uom_base_id', items:Store.state.uoms, valueKey:'id', labelKey:'nombre', required:true, value:String(prefill.uom_base_id || '')}));
    const activo = Field('Activo', (()=>{ const s=Select({name:'activo', items:[{id:1,nombre:'Si'},{id:0,nombre:'No'}], valueKey:'id'}); s.value = prefill.activo != null ? String(prefill.activo) : '1'; return s;})());

    const costField = Field('Costo estándar (CRC)', Input({name:'costo_estandar_crc', type:'number', step:'0.01', value: prefill.costo_estandar_crc != null ? String(prefill.costo_estandar_crc) : ''}), {hint:'Costo unitario base usado para inventario y producción'});
    const priceField = Field('Precio de venta (PT)', Input({name:'precio_venta_crc', type:'number', step:'0.01', value: prefill.precio_venta_crc != null ? String(prefill.precio_venta_crc) : ''}), {hint:'Se usa como precio por defecto en ventas'});

    function toggleTipoProducto() {
      const isPT = tipoSel.value === 'PT';
      priceField.style.display = isPT ? '' : 'none';
    }
    tipoSel.addEventListener('change', toggleTipoProducto);
    toggleTipoProducto();

    form.append(sku,nom,tipo,uom,costField,priceField,activo);

    Modal.open({
      title: isEdit ? 'Editar producto' : 'Nuevo producto',
      okText: isEdit ? 'Guardar cambios' : 'Crear producto',
      content: form,
      onOk: async () => {
        const payload = Object.fromEntries(new FormData(form).entries());
        if (!payload.sku) payload.sku = `${slug(payload.nombre).slice(0,12)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
        payload.uom_base_id = Number(payload.uom_base_id);
        if (payload.precio_venta_crc !== undefined && payload.precio_venta_crc !== '') payload.precio_venta_crc = Number(payload.precio_venta_crc);
        if (payload.costo_estandar_crc !== undefined && payload.costo_estandar_crc !== '') payload.costo_estandar_crc = Number(payload.costo_estandar_crc);
        if (payload.activo != null) payload.activo = Number(payload.activo);
        try {
          if (isEdit) {
            await fetchJSON(api(`/productos/${prefill.id}`), {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            Toast('Producto actualizado','success');
          } else {
            const created = await fetchJSON(api('/productos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            Toast('Producto creado','success');
            handleProductCreated(created, { openRecipe: true });
          }
          await refreshProductos();
          renderList(currentQuery);
        } catch(e){ Toast(e.message || 'Error al guardar producto','error'); return false; }
      }
    });
  }

  function handlePendingProductModal() {
    let pending = null;
    try {
      const raw = sessionStorage.getItem('pendingProductModal');
      if (raw) pending = JSON.parse(raw);
    } catch (err) {
      console.warn('No se pudo leer el producto pendiente', err);
    }
    if (!pending) return;
    sessionStorage.removeItem('pendingProductModal');
    openProductoModal(pending);
  }

  if (window.__pendingProductModalHandler) {
    window.removeEventListener('product-modal-pending', window.__pendingProductModalHandler);
  }
  window.__pendingProductModalHandler = handlePendingProductModal;
  window.addEventListener('product-modal-pending', handlePendingProductModal);
  handlePendingProductModal();
});
route('#/contactos', (root) => {
  const meta = {
    clientes: { plural: 'clientes', singular: 'cliente', title: 'Clientes' },
    proveedores: { plural: 'proveedores', singular: 'proveedor', title: 'Proveedores' },
    empleados: { plural: 'empleados', singular: 'empleado', title: 'Empleados' }
  };
  let currentKind = 'clientes';

  const tabs = document.createElement('div'); tabs.className='tabs';
  tabs.innerHTML = `
    <button class="active" data-t="clientes">Clientes</button>
    <button data-t="proveedores">Proveedores</button>
    <button data-t="empleados">Empleados</button>
    <span class="spacer"></span>
    <button class="btn-primary" id="btnNuevoContacto">+ Nuevo</button>`;
  root.appendChild(tabs);

  const list = document.createElement('div'); root.appendChild(list);

  async function refresh(kind) {
    const base = meta[kind].plural;
    try {
      const data = await fetchJSON(api(`/contactos/${base}`));
      Store.set({ [base]: data });
      render(kind);
    } catch (err) {
      console.error(err);
      Toast('No se pudieron cargar los contactos', 'error');
    }
  }

  function render(kind = currentKind) {
    currentKind = kind;
    tabs.querySelectorAll('button[data-t]').forEach(b=>b.classList.toggle('active', b.dataset.t===kind));
    const rows = Store.state[kind] || [];
    list.innerHTML='';
    const cols = [
      {key:'nombre',label:'Nombre'},
      {key:'num_doc',label:'Documento'},
      {key:'telefono',label:'Teléfono'},
      {key:'email',label:'Email'},
      {key:'direccion',label:'Dirección'}
    ];
    if (kind === 'empleados') {
      cols.push({key:'tarifa_hora_crc',label:'Tarifa hora',format:fmt.money});
    }
    cols.push({
      key:'id',
      label:'Acciones',
      render:(row)=>{
        const wrap = document.createElement('div'); wrap.className='table-actions';
        const editBtn = document.createElement('button');
        editBtn.type='button'; editBtn.className='icon-btn';
        editBtn.textContent='Editar'; editBtn.title='Editar';
        editBtn.onclick = () => openContactModal({ mode:'edit', kind, record: row });
        const delBtn = document.createElement('button');
        delBtn.type='button'; delBtn.className='icon-btn';
        delBtn.textContent='Eliminar'; delBtn.title='Eliminar';
        delBtn.onclick = async () => {
          if (!confirm(`Eliminar ${meta[kind].singular} ${row.nombre}?`)) return;
          try {
            await fetchJSON(api(`/contactos/${meta[kind].plural}/${row.id}`), { method:'DELETE' });
            Toast('Registro eliminado','success');
            await refresh(kind);
          } catch (err) {
            Toast(err?.message || 'No se pudo eliminar', 'error');
          }
        };
        wrap.append(editBtn, delBtn);
        return wrap;
      }
    });
    list.appendChild(Table({columns:cols, rows}));
  }
  render('clientes');

  tabs.addEventListener('click', (e)=>{
    if (e.target.matches('[data-t]')) {
      render(e.target.dataset.t);
    }
    if (e.target.id==='btnNuevoContacto') openContactModal({ mode:'create', kind:currentKind });
  });

  function openContactModal({ mode = 'create', kind = 'clientes', record = null } = {}) {
    const isEdit = mode === 'edit' && record;
    const singular = meta[kind].singular;
    const form=document.createElement('form'); form.className='form-grid';
    let tipoSel = null;
    if (!isEdit) {
      tipoSel = Select({name:'tipo',items:[
        {id:'clientes',nombre:'Cliente'},
        {id:'proveedores',nombre:'Proveedor'},
        {id:'empleados',nombre:'Empleado'}
      ], valueKey:'id'});
      tipoSel.value = kind;
      form.append(Field('Tipo', tipoSel));
    }
    const nombre= Field('Nombre', Input({name:'nombre', required:true, value: record?.nombre || ''}));
    const numdoc= Field('Documento', Input({name:'num_doc', value: record?.num_doc || ''}));
    const tel   = Field('Teléfono', Input({name:'telefono', value: record?.telefono || ''}));
    const email = Field('Email', Input({name:'email', value: record?.email || ''}));
    const dir   = Field('Dirección', Input({name:'direccion', value: record?.direccion || ''}));
    const activo = Field('Activo', (()=>{ const s=Select({name:'activo', items:[{id:1,nombre:'Si'},{id:0,nombre:'No'}], valueKey:'id'}); s.value = record?.activo != null ? String(record.activo) : '1'; return s;})());
    form.append(nombre,numdoc,tel,email,dir,activo);

    let tarifaField = null;
    if ((isEdit && kind === 'empleados') || (!isEdit && (tipoSel?.value === 'empleados'))) {
      tarifaField = Field('Tarifa x hora (CRC)', Input({name:'tarifa_hora_crc', type:'number', step:'0.01', value: record?.tarifa_hora_crc != null ? String(record.tarifa_hora_crc) : ''}));
      form.append(tarifaField);
    }

    if (tipoSel) {
      tipoSel.addEventListener('change', () => {
        if (tipoSel.value === 'empleados') {
          if (!tarifaField) {
            tarifaField = Field('Tarifa x hora (CRC)', Input({name:'tarifa_hora_crc', type:'number', step:'0.01', required:true}));
            form.append(tarifaField);
          }
        } else if (tarifaField) {
          tarifaField.remove();
          tarifaField = null;
        }
      });
    }

    Modal.open({
      title: isEdit ? `Editar ${singular}` : 'Nuevo contacto',
      okText: 'Guardar',
      content: form,
      onOk: async () => {
        const data = Object.fromEntries(new FormData(form).entries());
        const targetKind = isEdit ? kind : (data.tipo || kind);
        if (!data.nombre || !data.nombre.trim()) {
          Toast('Nombre requerido','error');
          return false;
        }
        if (data.activo != null) data.activo = Number(data.activo);
        if (data.tarifa_hora_crc !== undefined && data.tarifa_hora_crc !== '') data.tarifa_hora_crc = Number(data.tarifa_hora_crc);
        try {
          if (isEdit) {
            await fetchJSON(api(`/contactos/${meta[targetKind].plural}/${record.id}`), {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
            Toast('Contacto actualizado','success');
          } else {
            await fetchJSON(api(`/contactos/${meta[targetKind].plural}`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
            Toast('Contacto creado','success');
          }
          await refresh(targetKind);
          if (targetKind !== currentKind) render(targetKind);
        } catch (err) {
          Toast(err?.message || 'No se pudo guardar el contacto','error');
          return false;
        }
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

  // === Línea de venta con costo estimado + margen y precio sugerido ===
  function lineComponent(){
    const row=document.createElement('div'); row.className='line';
    const prodWrap = Field('Producto', Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), required:true}));
    const addPT = document.createElement('button'); addPT.type='button'; addPT.className='icon-btn'; addPT.textContent='＋'; addPT.title='Nuevo PT';
    addPT.onclick=()=>openProductoInline('PT', prodWrap.querySelector('select'));
    prodWrap.appendChild(addPT);

    const uom  = Field('UOM', Select({name:'uom_id', items:Store.state.uoms, required:true}));
    const cant = Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', required:true, value:'1'}));
    const precio= Field('Precio', Input({name:'precio_unitario_crc', type:'number', step:'0.01', required:true, value:'0'}));

    const costoEst= Field('Costo est.', Input({name:'costo_estimado_crc', type:'number', step:'0.01', value:'0'}));
    const margen = Field('Margen %', Input({name:'margen_pct', type:'number', step:'0.01', value:'40'}));

    const desc = Field('Desc', Input({name:'descuento_crc', type:'number', step:'0.01', value:'0'}));
    const del = document.createElement('button'); del.type='button'; del.className='icon-btn'; del.textContent='🗑'; del.title='Eliminar'; del.setAttribute('aria-label','Eliminar'); del.onclick=()=>{ row.remove(); calc(); };

    row.append(prodWrap, uom, cant, precio, costoEst, margen, desc, del);

    function recalcPrecioSugerido(){
      const c = Number(row.querySelector('input[name="costo_estimado_crc"]').value||0);
      const m = Number(row.querySelector('input[name="margen_pct"]').value||0);
      if (c>0) {
        const m01 = m>1 ? m/100 : m;
        const sug = c * (1+m01);
        const precioEl = row.querySelector('input[name="precio_unitario_crc"]');
        if (!Number(precioEl.value)) precioEl.value = String(sug.toFixed(2));
      }
    }

    // Cuando eligen producto, fija UOM base y estima costo desde receta si existe
    row.addEventListener('change', async (e)=>{
      if (e.target.name === 'producto_id') {
        const pid = Number(e.target.value||0);
        const prod = Store.state.productos.find(p=>p.id===pid);
        if (prod) {
          const uomSel = uom.querySelector('select');
          uomSel.value = String(prod.uom_base_id);
          uomSel.disabled = true;
          if (Number(prod.precio_venta_crc||0) > 0) {
            row.querySelector('input[name="precio_unitario_crc"]').value = String(Number(prod.precio_venta_crc).toFixed(2));
          }
        } else {
          uom.querySelector('select').disabled = false;
        }
        // Buscar receta del PT y costear
        try{
          const recetas = await fetchJSON(api('/recetas')).catch(()=>[]);
          const rec = recetas.find(r => Number(r.producto_salida_id)===pid);
          if (rec) {
            const res = await fetchJSON(api(`/costeo/recetas/${rec.id}`)).catch(()=>null);
            const unit = Number(res?.unitario_crc||0);
            row.querySelector('input[name="costo_estimado_crc"]').value = unit ? String(unit.toFixed(2)) : '0';
            recalcPrecioSugerido();
          }
        }catch(_){}
      }
      if (e.target.name==='margen_pct' || e.target.name==='costo_estimado_crc') recalcPrecioSugerido();
    });

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
    const tipoSelEl = Select({name:'tipo', items:[{id:'MP',nombre:'Materia Prima'},{id:'PT',nombre:'Producto Terminado'}], valueKey:'id', required:true});
    tipoSelEl.value = tipo; tipoSelEl.disabled = true; // En ventas, forzamos PT
    const costField = Field('Costo estándar (CRC)', Input({name:'costo_estandar_crc', type:'number', step:'0.01', required:true}));
    const priceField = Field('Precio de venta (PT)', Input({name:'precio_venta_crc', type:'number', step:'0.01'}));
    form.append(
      Field('Código interno (SKU)', Input({name:'sku', placeholder:'Opcional'})),
      Field('Nombre', Input({name:'nombre', required:true})),
      Field('Tipo', tipoSelEl),
      Field('UOM base', Select({name:'uom_base_id', items:Store.state.uoms, valueKey:'id', labelKey:'nombre', required:true})),
      costField,
      priceField
    );

    function toggleInlineTipo() {
      const isPT = tipoSelEl.value === 'PT';
      priceField.style.display = isPT ? '' : 'none';
    }
    tipoSelEl.addEventListener('change', toggleInlineTipo);
    toggleInlineTipo();

    Modal.open({
      title:'Nuevo producto',
      content: form,
      onOk: async ()=>{
        const payload = Object.fromEntries(new FormData(form).entries());
        if (!payload.sku) payload.sku = `${slug(payload.nombre).slice(0,12)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
        payload.uom_base_id = Number(payload.uom_base_id);
        if (payload.precio_venta_crc !== undefined && payload.precio_venta_crc !== '') payload.precio_venta_crc = Number(payload.precio_venta_crc);
        if (payload.costo_estandar_crc !== undefined && payload.costo_estandar_crc !== '') payload.costo_estandar_crc = Number(payload.costo_estandar_crc);
        try{
          const created = await fetchJSON(api('/productos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          const productos = await fetchJSON(api('/productos')); Store.set({productos});
          if (selectEl) {
            selectEl.innerHTML='';
            const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione.'; selectEl.appendChild(ph);
            Store.state.productos.filter(p=>p.tipo==='PT').forEach(p=>selectEl.appendChild(new Option(p.nombre, p.id)));
            if (created?.id) {
              selectEl.value = String(created.id);
            } else {
              const found = Store.state.productos.find(p=>p.nombre===payload.nombre);
              selectEl.value = found ? String(found.id) : '';
            }
            selectEl.dispatchEvent(new Event('change'));
          }
          Toast('Producto creado','success');
          if (created?.tipo === 'PT') {
            if (confirm('Producto terminado creado. Desea registrar la receta ahora?')) {
              handleProductCreated(created, { openRecipe: true });
            }
          }
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
    const del  = document.createElement('button'); del.type='button'; del.className='icon-btn'; del.textContent='🗑'; del.title='Eliminar'; del.setAttribute('aria-label','Eliminar'); del.onclick=()=>{ row.remove(); calc(); };
    row.append(prodWrap, uom, cant, costo, desc, del);

    // Bloquear UOM a base y proponer costo desde /costos/mp
    row.addEventListener('change', async (e)=>{
      if (e.target.name === 'producto_id') {
        const pid = Number(e.target.value||0);
        const prod = Store.state.productos.find(p=>p.id===pid);
        if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
        else { uomSel.disabled = false; }
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
    const tipoSelEl = Select({name:'tipo', items:[{id:'MP',nombre:'Materia Prima'},{id:'PT',nombre:'Producto Terminado'}], valueKey:'id', required:true});
    tipoSelEl.value = tipo; tipoSelEl.disabled = true; // En compras, forzamos MP
    const costField = Field('Costo estándar (CRC)', Input({name:'costo_estandar_crc', type:'number', step:'0.01', required:true}));
    const priceField = Field('Precio de venta (PT)', Input({name:'precio_venta_crc', type:'number', step:'0.01'}));
    form.append(
      Field('Código interno (SKU)', Input({name:'sku', placeholder:'Opcional'})),
      Field('Nombre', Input({name:'nombre', required:true})),
      Field('Tipo', tipoSelEl),
      Field('UOM base', Select({name:'uom_base_id', items:Store.state.uoms, valueKey:'id', labelKey:'nombre', required:true})),
      costField,
      priceField
    );

    function toggleQuickTipo() {
      const isPT = tipoSelEl.value === 'PT';
      priceField.style.display = isPT ? '' : 'none';
    }
    tipoSelEl.addEventListener('change', toggleQuickTipo);
    toggleQuickTipo();

    Modal.open({
      title:'Nuevo producto',
      content: form,
      onOk: async ()=>{
        const payload = Object.fromEntries(new FormData(form).entries());
        if (!payload.sku) payload.sku = `${slug(payload.nombre).slice(0,12)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
        payload.uom_base_id = Number(payload.uom_base_id);
        if (payload.precio_venta_crc !== undefined && payload.precio_venta_crc !== '') payload.precio_venta_crc = Number(payload.precio_venta_crc);
        if (payload.costo_estandar_crc !== undefined && payload.costo_estandar_crc !== '') payload.costo_estandar_crc = Number(payload.costo_estandar_crc);
        try{
          const created = await fetchJSON(api('/productos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          const productos = await fetchJSON(api('/productos')); Store.set({productos});
          if (selectEl) {
            selectEl.innerHTML='';
            const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione.'; selectEl.appendChild(ph);
            Store.state.productos.filter(p=>p.tipo==='MP').forEach(p=>selectEl.appendChild(new Option(p.nombre, p.id)));
            if (created?.id) {
              selectEl.value = String(created.id);
            } else {
              const found = Store.state.productos.find(p=>p.nombre===payload.nombre);
              selectEl.value = found ? String(found.id) : '';
            }
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

  let recetasCache = [];
  let currentRecipeQuery = '';
  const getProductoNombre = (id) => {
    if (!id) return '';
    const found = Store.state.productos.find(p => Number(p.id) === Number(id));
    return found ? found.nombre : `#${id}`;
  };

  async function renderList(q=null){
    try {
      recetasCache = await fetchJSON(api('/recetas'));
    } catch (_) {
      recetasCache = [];
    }
    currentRecipeQuery = q || '';
    const term = currentRecipeQuery ? currentRecipeQuery.toLowerCase() : '';
    const rows = recetasCache.filter(r => !term || (r.nombre || '').toLowerCase().includes(term));
    root.querySelector('.table-wrap')?.remove();
    const columns = [
      {key:'nombre',label:'Nombre'},
      {key:'producto_salida_id',label:'Prod. salida',format: (value) => getProductoNombre(value)},
      {key:'uom_salida_id',label:'UOM salida'},
      {key:'activo',label:'Activo'},
      {
        key:'id',
        label:'Acciones',
        render:(row)=>{
          const wrap=document.createElement('div'); wrap.className='table-actions';
          const editBtn=document.createElement('button'); editBtn.type='button'; editBtn.className='icon-btn'; editBtn.textContent='Editar'; editBtn.title='Editar';
          editBtn.onclick=()=>handleEditReceta(row.id);
          const delBtn=document.createElement('button'); delBtn.type='button'; delBtn.className='icon-btn'; delBtn.textContent='Eliminar'; delBtn.title='Eliminar';
          delBtn.onclick=()=>handleDeleteReceta(row);
          wrap.append(editBtn, delBtn);
          return wrap;
        }
      }
    ];
    root.appendChild(Table({columns, rows}));
  }

  async function handleEditReceta(id) {
    try {
      const data = await fetchJSON(api(`/recetas/${id}`));
      openRecetaModal(data, { mode: 'edit' });
    } catch (err) {
      console.error(err);
      Toast('No se pudo cargar la receta', 'error');
    }
  }

  async function handleDeleteReceta(row) {
    if (!row || !row.id) return;
    if (!confirm(`Eliminar receta ${row.nombre || '#' + row.id}?`)) return;
    try {
      await fetchJSON(api(`/recetas/${row.id}`), { method: 'DELETE' });
      Toast('Receta eliminada', 'success');
      await renderList(currentRecipeQuery);
    } catch (err) {
      console.error(err);
      Toast(err?.message || 'No se pudo eliminar la receta', 'error');
    }
  }
  renderList();

  // === Costeo de receta (usa costos base desde compras) + Márgen/IVA ===
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
      <label class="field"><span>% Margen sugerido</span><input name="margen" type="number" step="0.01" placeholder="40 = 40%"></label>
      <label class="field"><span>% Impuesto (opcional)</span><input name="iva" type="number" step="0.01" placeholder="13 = 13%"></label>
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
    const margenInput = costPanel.querySelector('input[name="margen"]').value;
    const ivaInput = costPanel.querySelector('input[name="iva"]').value;

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
        const otros = Number(it.otros_costos_crc||0);
        const total = unit * qty + otros;
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

      // Precio sugerido
      const mg = normPct(margenInput) || 0;
      const iva = normPct(ivaInput) || 0;
      const precioSugerido = unitario != null ? (unitario * (1+mg) * (1+iva)) : null;

      // KPIs
      const kpi = costPanel.querySelector('#recetaCostKPI'); kpi.innerHTML='';
      const mk = (t,v)=>{ const c=document.createElement('div'); c.className='card kpi'; c.innerHTML=`<h3>${t}</h3><div class="big">${v==null?'—':fmt.money(v)}</div>`; return c; };
      kpi.append(
        mk('Directo', directo),
        mk('Indirecto', indirecto),
        mk('Total receta', total),
        mk('Unitario estimado', unitario ?? null),
        mk('Precio sugerido', precioSugerido ?? null)
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

  function openRecetaModal(prefill = {}, options = {}){
    const mode = options.mode || (prefill?.id ? 'edit' : 'create');
    const isEdit = mode === 'edit';
    const recetaId = isEdit ? prefill.id : null;

    const form = document.createElement('form'); form.className='form-grid';
    const nombre = Field('Nombre', Input({name:'nombre', required:true, value: prefill.nombre || ''}));
    const prodOut= Field('Producto salida (PT)', Select({name:'producto_salida_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), value: prefill.producto_salida_id ? String(prefill.producto_salida_id) : ''}));
    const addPT = document.createElement('button'); addPT.type='button'; addPT.className='icon-btn'; addPT.textContent='+'; addPT.title='Nuevo PT'; addPT.onclick=()=>quickProduct('PT', prodOut.querySelector('select'));
    prodOut.appendChild(addPT);
    const uomOut = Field('UOM salida', Select({name:'uom_salida_id', items:Store.state.uoms, value: prefill.uom_salida_id ? String(prefill.uom_salida_id) : ''}));
    const manoObra = Field('Mano de obra (CRC)', Input({name:'mano_obra_crc', type:'number', step:'0.01', value: prefill.mano_obra_crc != null ? String(prefill.mano_obra_crc) : '0'}));
    const mermaEst = Field('Merma estimada (CRC)', Input({name:'merma_crc', type:'number', step:'0.01', value: prefill.merma_crc != null ? String(prefill.merma_crc) : '0'}));
    const pctInd = Field('% Indirectos', Input({name:'indirectos_pct', type:'number', step:'0.01', value: prefill.indirectos_pct != null ? String(prefill.indirectos_pct) : ''}), {hint:'Si vacio, se aplicara el % global'});
    const nota   = Field('Notas', Input({name:'nota', value: prefill.nota || ''}));
    form.append(nombre, prodOut, uomOut, manoObra, mermaEst, pctInd, nota);

    const nombreInput = nombre.querySelector('input');
    const prodOutSelect = prodOut.querySelector('select');
    const uomOutSelect = uomOut.querySelector('select');
    const productPrefill = prefill?.productoId ? Store.state.productos.find(p => Number(p.id) === Number(prefill.productoId)) : null;
    if (prefill?.productoId) {
      prodOutSelect.value = String(prefill.productoId);
      prodOutSelect.disabled = true;
      addPT.disabled = true;
    }
    if (prefill?.producto_salida_id) {
      prodOutSelect.value = String(prefill.producto_salida_id);
    }
    if (prefill?.uom_salida_id) {
      uomOutSelect.value = String(prefill.uom_salida_id);
    } else if (productPrefill?.uom_base_id) {
      uomOutSelect.value = String(productPrefill.uom_base_id);
    }
    if (!nombreInput.value && (prefill?.productoNombre || productPrefill?.nombre)) {
      nombreInput.value = prefill?.productoNombre || productPrefill?.nombre || '';
    }
    if (prefill?.createPT) {
      setTimeout(() => addPT.click(), 120);
    }

    const ingredientes = document.createElement('div'); ingredientes.className='subpanel';
    ingredientes.innerHTML = '<h4>Ingredientes (MP) con costos</h4>';
    const ingLines = document.createElement('div'); ingLines.className='lines';
    const addIng = document.createElement('button'); addIng.type='button'; addIng.textContent='+ Agregar';
    ingredientes.append(ingLines, addIng);

    const totBox = document.createElement('div'); totBox.className='kpi-grid';
    totBox.innerHTML = `
      <div class="card kpi"><h3>Materiales</h3><div class="big" id="k_mat">?0,00</div></div>
      <div class="card kpi"><h3>Otros</h3><div class="big" id="k_otr">?0,00</div></div>
      <div class="card kpi"><h3>Total ingredientes</h3><div class="big" id="k_totIng">?0,00</div></div>
      <div class="card kpi"><h3>Indirectos</h3><div class="big" id="k_ind">?0,00</div></div>
      <div class="card kpi"><h3>Mano de obra</h3><div class="big" id="k_mo">?0,00</div></div>
      <div class="card kpi"><h3>Merma</h3><div class="big" id="k_mer">?0,00</div></div>
      <div class="card kpi"><h3>Total receta</h3><div class="big" id="k_totRec">?0,00</div></div>
    `;
    ingredientes.appendChild(totBox);

    const salidas = document.createElement('div'); salidas.className='subpanel';
    salidas.innerHTML = '<h4>Salidas (PT)</h4>';
    const outLines = document.createElement('div'); outLines.className='lines';
    const addOut = document.createElement('button'); addOut.type='button'; addOut.textContent='+ Agregar';
    salidas.append(outLines, addOut);

    const wrap = document.createElement('div'); wrap.append(form, ingredientes, salidas);

    const ingRow = (pref = null) => {
      const row=document.createElement('div'); row.className='line';
      const mpSel = Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='MP'), required:true, value: pref?.producto_id ? String(pref.producto_id) : ''});
      const uomSel = Select({name:'uom_id', items:Store.state.uoms, required:true, value: pref?.uom_id ? String(pref.uom_id) : ''});
      const cant = Field('Cantidad', Input({name:'cantidad', type:'number', step:'0.000001', required:true, value: pref?.cantidad != null ? String(pref.cantidad) : '1'}));
      const costo = Field('Costo unitario (CRC)', Input({name:'costo_unitario_crc', type:'number', step:'0.000001', value: pref?.costo_unitario_crc != null ? String(pref.costo_unitario_crc) : '0'}));
      const otros = Field('Otros costos (CRC)', Input({name:'otros_costos_crc', type:'number', step:'0.000001', value: pref?.otros_costos_crc != null ? String(pref.otros_costos_crc) : '0'}));
      const del = document.createElement('button'); del.type='button'; del.className='icon-btn'; del.textContent='Eliminar'; del.onclick=()=>{ row.remove(); recalcTotals(); };
      row.append(Field('MP', mpSel), Field('UOM', uomSel), cant, costo, otros, del);
      row.addEventListener('change', (e)=>{
        if (e.target.name === 'producto_id') {
          const pid = Number(e.target.value||0);
          const prod = Store.state.productos.find(p=>p.id===pid);
          if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
          else { uomSel.disabled = false; }
        }
        recalcRow();
      });
      row.addEventListener('input', recalcRow);
      function recalcRow(){
        recalcTotals();
      }
      if (pref?.producto_id) {
        mpSel.value = String(pref.producto_id);
        mpSel.dispatchEvent(new Event('change'));
      }
      return row;
    };

    const outRow = (pref = null) => {
      const row=document.createElement('div'); row.className='line';
      const ptSel = Select({name:'producto_id', items:Store.state.productos.filter(p=>p.tipo==='PT'), required:true, value: pref?.producto_id ? String(pref.producto_id) : ''});
      const uomSel = Select({name:'uom_id', items:Store.state.uoms, required:true, value: pref?.uom_id ? String(pref.uom_id) : ''});
      const rendimientoField = Field('Rendimiento', Input({name:'rendimiento', type:'number', step:'0.000001', required:true, value: pref?.rendimiento != null ? String(pref.rendimiento) : '1'}));
      const removeBtn = document.createElement('button'); removeBtn.type='button'; removeBtn.className='icon-btn'; removeBtn.textContent='Eliminar'; removeBtn.onclick=()=>{ row.remove(); };
      row.append(Field('PT', ptSel), Field('UOM', uomSel), rendimientoField, removeBtn);
      row.addEventListener('change', (e)=>{
        if (e.target.name === 'producto_id') {
          const pid = Number(e.target.value||0);
          const prod = Store.state.productos.find(p=>p.id===pid);
          if (prod) { uomSel.value = String(prod.uom_base_id); uomSel.disabled = true; }
          else { uomSel.disabled = false; }
        }
      });
      if (pref?.producto_id) {
        ptSel.value = String(pref.producto_id);
        ptSel.dispatchEvent(new Event('change'));
      }
      return row;
    };

    function recalcTotals(){
      const lines = $$('.line', ingLines);
      let mat=0, otros=0;
      lines.forEach(l=>{
        const q = Number(l.querySelector('input[name="cantidad"]').value||0);
        const cu = Number(l.querySelector('input[name="costo_unitario_crc"]').value||0);
        const ot = Number(l.querySelector('input[name="otros_costos_crc"]').value||0);
        mat += q*cu; otros += ot;
      });
      const totIng = mat + otros;
      const mo = Number(form.querySelector('input[name="mano_obra_crc"]').value||0);
      const mer = Number(form.querySelector('input[name="merma_crc"]').value||0);
      const pct = form.querySelector('input[name="indirectos_pct"]').value;
      const pctN = pct === '' ? null : Number(pct);
      const ind = (pctN==null ? (totIng * (globalPct||0)) : (totIng * ((pctN>1?pctN/100:pctN)||0)));
      const totRec = totIng + ind + mo + mer;

      $('#k_mat', totBox).textContent = fmt.money(mat);
      $('#k_otr', totBox).textContent = fmt.money(otros);
      $('#k_totIng', totBox).textContent = fmt.money(totIng);
      $('#k_ind', totBox).textContent = fmt.money(ind);
      $('#k_mo', totBox).textContent = fmt.money(mo);
      $('#k_mer', totBox).textContent = fmt.money(mer);
      $('#k_totRec', totBox).textContent = fmt.money(totRec);
    }

    addIng.onclick=()=> { ingLines.appendChild(ingRow()); recalcTotals(); };
    addOut.onclick=()=> outLines.appendChild(outRow());

    if (Array.isArray(prefill.ingredientes) && prefill.ingredientes.length) {
      prefill.ingredientes.forEach(item => ingLines.appendChild(ingRow(item)));
    } else if (productPrefill) {
      ingLines.appendChild(ingRow());
    } else {
      ingLines.appendChild(ingRow());
    }

    if (Array.isArray(prefill.salidas) && prefill.salidas.length) {
      prefill.salidas.forEach(item => outLines.appendChild(outRow(item)));
    } else if (prefill.productoId || prefill.producto_salida_id) {
      outLines.appendChild(outRow({
        producto_id: prefill.productoId || prefill.producto_salida_id,
        uom_id: productPrefill?.uom_base_id || prefill.uom_salida_id || null,
        rendimiento: 1
      }));
    } else {
      outLines.appendChild(outRow());
    }

    recalcTotals();

    form.addEventListener('input', (e)=>{
      if (['mano_obra_crc','merma_crc','indirectos_pct'].includes(e.target.name)) recalcTotals();
    });

    Modal.open({
      title: isEdit ? 'Editar receta' : 'Nueva receta',
      okText: 'Guardar',
      content: wrap,
      onOk: async ()=>{
        const payload = Object.fromEntries(new FormData(form).entries());
        payload.producto_salida_id = Number(payload.producto_salida_id || 0);
        payload.uom_salida_id = Number(payload.uom_salida_id || 0);
        payload.mano_obra_crc = Number(payload.mano_obra_crc || 0);
        payload.merma_crc = Number(payload.merma_crc || 0);
        payload.indirectos_pct = payload.indirectos_pct === '' ? null : Number(payload.indirectos_pct);
        if (!payload.producto_salida_id) { Toast('Selecciona el producto de salida','error'); return false; }
        if (!payload.uom_salida_id) { Toast('Selecciona la UOM de salida','error'); return false; }

        const ingData = [];
        for (const row of $$('.line', ingLines)) {
          const data = Object.fromEntries($$('select,input', row).map(el=>[el.name, el.value]));
          const item = {
            producto_id: Number(data.producto_id || 0),
            uom_id: Number(data.uom_id || 0),
            cantidad: Number(data.cantidad || 0),
            costo_unitario_crc: Number(data.costo_unitario_crc || 0),
            otros_costos_crc: Number(data.otros_costos_crc || 0)
          };
          if (!item.producto_id || !item.uom_id || item.cantidad <= 0) {
            Toast('Revisa los ingredientes, hay datos incompletos','error');
            return false;
          }
          ingData.push(item);
        }
        if (!ingData.length) { Toast('Agrega al menos un ingrediente','error'); return false; }

        const outData = [];
        for (const row of $$('.line', outLines)) {
          const data = Object.fromEntries($$('select,input', row).map(el=>[el.name, el.value]));
          const item = {
            producto_id: Number(data.producto_id || 0),
            uom_id: Number(data.uom_id || 0),
            rendimiento: Number(data.rendimiento || 0)
          };
          if (!item.producto_id || !item.uom_id || item.rendimiento <= 0) {
            Toast('Revisa las salidas, hay datos incompletos','error');
            return false;
          }
          outData.push(item);
        }
        if (!outData.length) { Toast('Agrega al menos una salida','error'); return false; }

        payload.ingredientes = ingData;
        payload.salidas = outData;

        try{
          if (isEdit) {
            await fetchJSON(api(`/recetas/${recetaId}`), {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            Toast('Receta actualizada','success');
          } else {
            await fetchJSON(api('/recetas'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            Toast('Receta creada','success');
          }
          await renderList(currentRecipeQuery);
        }catch(e){ Toast(e.message || 'Error al guardar la receta','error'); return false; }
      }
    });
  }

  const handlePendingRecipe = () => {
    let pendingProduct = null;
    try {
      const raw = sessionStorage.getItem('pendingRecipeProduct');
      if (raw) pendingProduct = JSON.parse(raw);
    } catch (err) {
      console.warn('No se pudo leer la receta pendiente', err);
    }
    if (pendingProduct) {
      sessionStorage.removeItem('pendingRecipeProduct');
      openRecetaModal({ productoId: pendingProduct.id, productoNombre: pendingProduct.nombre });
      return;
    }

    let pendingModal = null;
    try {
      const rawModal = sessionStorage.getItem('pendingRecipeModal');
      if (rawModal) pendingModal = JSON.parse(rawModal);
    } catch (err) {
      console.warn('No se pudo leer pendingRecipeModal', err);
      pendingModal = {};
    }
    if (pendingModal) {
      sessionStorage.removeItem('pendingRecipeModal');
      openRecetaModal(typeof pendingModal === 'object' ? pendingModal : {});
    }
  };

  if (window.__pendingRecipeHandler) {
    window.removeEventListener('recipe-pending-ready', window.__pendingRecipeHandler);
  }
  window.__pendingRecipeHandler = handlePendingRecipe;
  window.addEventListener('recipe-pending-ready', handlePendingRecipe);
  handlePendingRecipe();

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

/* ================= INVENTARIO ================= */
route('#/inventario', async (root)=>{
  const bar=Toolbar(
    (()=>{ const b=document.createElement('button'); b.textContent='MP'; b.onclick=()=>load('mp'); return b;})(),
    (()=>{ const b=document.createElement('button'); b.textContent='PT'; b.onclick=()=>load('pt'); return b;})(),
    (()=>{ const b=document.createElement('button'); b.textContent='Resumen'; b.onclick=()=>load('resumen'); return b;})(),
    (()=>{ const b=document.createElement('button'); b.textContent='Mermas'; b.onclick=()=>load('mermas'); return b;})(),
    (()=>{ const b=document.createElement('button'); b.className='btn-primary'; b.textContent='Registrar merma'; b.onclick=()=>openMerma(); return b;})(),
  );
  root.appendChild(bar);
  const cont=document.createElement('div'); root.appendChild(cont);

  async function load(kind){
    cont.innerHTML='Cargando…';
    if (kind==='mermas') {
      const data = await fetchJSON(api(`/inventario/mermas`)).catch(()=>[]);
      const cols = [
        {key:'fecha',label:'Fecha',format:fmt.date},
        {key:'producto_nombre',label:'Producto'},
        {key:'uom_nombre',label:'UOM'},
        {key:'cantidad',label:'Cantidad'},
        {key:'costo_unitario_crc',label:'Costo u.',format:fmt.money},
        {key:'costo_total_crc',label:'Costo total',format:fmt.money},
        {key:'motivo',label:'Motivo'},
        {key:'nota',label:'Nota'}
      ];
      cont.innerHTML=''; cont.appendChild(Table({columns:cols, rows:data}));
      return;
    }
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
      Field('Nota', Input({name:'nota'})),
      Field('Costo u. (auto)', Input({name:'costo_unitario_crc', type:'number', step:'0.0001', value:'0'}))
    );
    // Autocompletar costo u. según MP/PT
    const selProd = form.querySelector('select[name="producto_id"]');
    selProd.onchange = async ()=>{
      const pid = Number(selProd.value||0);
      if (!pid) return;
      const prod = Store.state.productos.find(p=>Number(p.id)===pid);
      let cu = 0;
      if (prod?.tipo === 'MP') {
        const map = await getCostosMP([pid]);
        cu = Number(map[pid]||0);
      } else if (prod?.tipo === 'PT') {
        cu = await getCostoUnitarioPT(pid);
      }
      form.querySelector('input[name="costo_unitario_crc"]').value = cu ? String(cu.toFixed(4)) : '0';
    };

    Modal.open({
      title:'Registrar merma',
      content:form,
      onOk: async ()=>{
        const payload=Object.fromEntries(new FormData(form).entries());
        // Si no envían costo, backend puede calcular; enviamos si se ve > 0
        payload.costo_unitario_crc = Number(payload.costo_unitario_crc||0) || undefined;
        try{
          await fetchJSON(api('/inventario/merma'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          Toast('Merma registrada','success');
        }catch(e){ Toast(e.message,'error'); return false; }
      }
    });
  }
});

/* ================= FINANZAS ================= */
route('#/finanzas', async (root)=>{
  const tabs = document.createElement('div'); tabs.className='tabs';
  tabs.innerHTML = `
    <button class="active" data-t="cuentas">Cuentas</button>
    <button data-t="gastos">Gastos</button>
    <button data-t="indirectos">Indirectos</button>
    <span class="spacer"></span>
  `;
  root.appendChild(tabs);

  const cont = document.createElement('div'); root.appendChild(cont);

  async function renderCuentas(){
    cont.innerHTML='';
    const head=document.createElement('div'); head.className='card';
    head.innerHTML = `<b>Saldos por cobrar/pagar</b> - Se calculan desde las facturas de ventas/compras (contado o crédito).`;
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
          <select name="activo"><option value="1">Si</option><option value="0">No</option></select>
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

  
  async function renderGastos(){
    cont.innerHTML='';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h3>Gastos operativos</h3>
      <div class="form-grid">
        <label class="field"><span>Fecha</span><input name="g_fecha" type="date" value="${today()}"></label>
        <label class="field"><span>Categoría</span><input name="g_categoria" placeholder="General, Fletes, Servicios…"></label>
        <label class="field"><span>Monto (CRC)</span><input name="g_monto" type="number" step="0.01" value="0"></label>
        <label class="field"><span>Proveedor</span><select name="g_prov"></select></label>
        <label class="field"><span>Método</span><select name="g_met"><option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option><option>OTRO</option></select></label>
        <label class="field" style="grid-column:1/-1"><span>Nota</span><input name="g_nota" placeholder="Opcional"></label>
        <div class="form-actions"><button id="btnAddGasto" class="btn-primary">Agregar gasto</button></div>
      </div>
      <div id="tablaGastos" style="margin-top:10px"></div>
    `;
    cont.appendChild(card);
    const selP = card.querySelector('select[name="g_prov"]'); selP.innerHTML='<option value="">—</option>'; (Store.state.proveedores||[]).forEach(p=> selP.appendChild(new Option(p.nombre, p.id)));
    async function load(){
      const rows = await fetchJSON(api('/finanzas/gastos')).catch(()=>[]);
      const box = card.querySelector('#tablaGastos'); box.innerHTML='';
      box.appendChild(Table({columns:[
        {key:'fecha',label:'Fecha',format:fmt.date},
        {key:'categoria',label:'Categoría'},
        {key:'proveedor_nombre',label:'Proveedor'},
        {key:'monto_crc',label:'Monto',format:fmt.money},
        {key:'metodo',label:'Método'},
        {key:'nota',label:'Nota'}
      ], rows}));
    }
    await load();
    card.querySelector('#btnAddGasto').onclick = async ()=>{
      const body = {
        fecha: card.querySelector('input[name="g_fecha"]').value,
        categoria: card.querySelector('input[name="g_categoria"]').value || 'General',
        monto_crc: Number(card.querySelector('input[name="g_monto"]').value||0),
        proveedor_id: Number(card.querySelector('select[name="g_prov"]').value||0) || null,
        metodo: card.querySelector('select[name="g_met"]').value || 'EFECTIVO',
        nota: card.querySelector('input[name="g_nota"]').value || null,
      };
      if (!body.fecha || body.monto_crc<=0) return Toast('Fecha y monto > 0','error');
      try{ await fetchJSON(api('/finanzas/gastos'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); Toast('Gasto registrado','success'); await load(); }
      catch(e){ Toast(e.message,'error'); }
    };
  }
function switchTab(kind){
    tabs.querySelectorAll('button[data-t]').forEach(b=>b.classList.toggle('active', b.dataset.t===kind));
    if (kind==='indirectos') renderIndirectos();
    else if (kind==='gastos') renderGastos();
    else renderCuentas();
  }

  tabs.addEventListener('click', (e)=>{
    if (e.target.matches('[data-t]')) switchTab(e.target.dataset.t);
  });

  switchTab('cuentas');
});

/* ================= RUTAS ================= */
route('#/rutas', async (root)=>{
  const top = document.createElement('div'); top.className='panel';
  top.innerHTML = `
    <h3>Rutas de entrega</h3>
    <div class="form-grid">
      <label class="field"><span>Nombre</span><input name="r_nombre" required></label>
      <label class="field"><span>Descripción</span><input name="r_desc"></label>
      <label class="field"><span>Día semana</span><input name="r_dia" placeholder="1=Lunes .. 7=Dom"></label>
      <label class="field"><span>Activo</span><select name="r_act"><option value="1">Si</option><option value="0">No</option></select></label>
      <div class="form-actions"><button id="btnAddRuta" class="btn-primary">Crear ruta</button></div>
    </div>
  `;
  root.appendChild(top);

  const grid = document.createElement('div'); grid.className='grid-2'; root.appendChild(grid);
  const lst = document.createElement('div'); lst.className='panel'; grid.appendChild(lst);
  const det = document.createElement('div'); det.className='panel'; grid.appendChild(det);

  async function loadRutas(){
    const rutas = await fetchJSON(api('/rutas')).catch(()=>[]);
    lst.innerHTML = '';
    const tbl = Table({columns:[
      {key:'nombre',label:'Nombre'}, {key:'descripcion',label:'Descripción'},
      {key:'dia_semana',label:'Día'}, {key:'activo',label:'Activo'}
    ], rows:rutas});
    lst.appendChild(tbl);
    lst.querySelectorAll('tbody tr').forEach((tr,i)=>{
      tr.style.cursor='pointer';
      tr.onclick=()=> openRuta(rutas[i]);
    });
  }
  await loadRutas();

  $('#btnAddRuta', top).onclick = async ()=>{
    const body={
      nombre: top.querySelector('input[name=r_nombre]').value,
      descripcion: top.querySelector('input[name=r_desc]').value||null,
      dia_semana: Number(top.querySelector('input[name=r_dia]').value||0)||null,
      activo: Number(top.querySelector('select[name=r_act]').value||1)
    };
    if (!body.nombre) return Toast('Nombre requerido','error');
    try{ await fetchJSON(api('/rutas'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); Toast('Ruta creada','success'); await loadRutas(); }
    catch(e){ Toast(e.message,'error'); }
  };

  async function openRuta(r){
    det.innerHTML = `<h3>${r.nombre}</h3>`;
    const wrap = document.createElement('div'); wrap.className='form-grid';
    wrap.innerHTML = `
      <label class="field"><span>Cliente</span><select name="rc_cli"></select></label>
      <label class="field"><span>Orden</span><input name="rc_orden" type="number" step="1" value="1"></label>
      <label class="field"><span>Ventana horaria</span><input name="rc_vh" placeholder="8:00-10:00"></label>
      <div class="form-actions"><button id="btnRutaAddCli" class="btn">Agregar</button></div>
    `;
    det.appendChild(wrap);
    const sel = wrap.querySelector('select[name=rc_cli]'); sel.innerHTML='<option value="">Seleccione…</option>';
    Store.state.clientes.forEach(c=> sel.appendChild(new Option(c.nombre, c.id)));

    const cont = document.createElement('div'); det.appendChild(cont);
    async function loadClientes(){
      const rows = await fetchJSON(api(`/rutas/${r.id}/clientes`)).catch(()=>[]);
      cont.innerHTML=''; cont.appendChild(Table({columns:[
        {key:'cliente_nombre',label:'Cliente'}, {key:'orden',label:'Orden'}, {key:'ventana_horaria',label:'Ventana'}
      ], rows}));
    }
    await loadClientes();

    $('#btnRutaAddCli', wrap).onclick = async ()=>{
      const body={ cliente_id: Number(sel.value||0), orden: Number(wrap.querySelector('input[name=rc_orden]').value||0), ventana_horaria: wrap.querySelector('input[name=rc_vh]').value||null, nota:null };
      if (!body.cliente_id) return Toast('Selecciona cliente','error');
      try{ await fetchJSON(api(`/rutas/${r.id}/clientes`), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); Toast('Cliente agregado','success'); await loadClientes(); }
      catch(e){ Toast(e.message,'error'); }
    };
  }
});

/* ================= PLANILLAS ================= */
route('#/planillas', (root) => {
  const tryRender = () => {
    if (typeof window.renderPlanillas === 'function') {
      window.renderPlanillas(root);
      return true;
    }
    return false;
  };

  if (tryRender()) return;

  root.innerHTML = '<div class="card"><h3>Planillas</h3><p class="muted">Cargando planillas...</p></div>';
  const onReady = () => {
    if (location.hash !== '#/planillas') return;
    if (tryRender()) {
      window.removeEventListener('planillas-ready', onReady);
    }
  };

  window.addEventListener('planillas-ready', onReady);
});

/* ================= BÚSQUEDA GLOBAL ================= */
const searchBtn = $('#searchBtn');
if (searchBtn) searchBtn.onclick = ()=> doSearch();
const globalSearch = $('#globalSearch');
if (globalSearch) globalSearch.addEventListener('keydown', e=>{ if (e.key==='Enter') doSearch(); });
function cardList(title, data, keys){
  const card=document.createElement('div'); card.className='card';
  card.innerHTML = `<h3>${title}</h3>`;
  const ul=document.createElement('ul'); ul.className='list';
  data.slice(0,12).forEach(r=>{
    const li=document.createElement('li'); li.innerHTML = keys.map(k=>`<span>${(r[k]??'')}</span>`).join(' - '); ul.appendChild(li);
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

/* ================= TEMA / NAV ================= */
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
  if (['#/ventas','#/compras','#/productos','#/contactos','#/recetas','#/produccion','#/planillas','#/inventario','#/finanzas','#/rutas'].includes(h)) navigate(h);
});

// Quick create -> ir a ventas
const quick = $('#quickCreateBtn');
if (quick) quick.onclick = () => openQuickCreate();

function openQuickCreate() {
  const tpl = document.getElementById('tpl-quick-create');
  if (!tpl) { location.hash = '#/ventas'; return; }
  const content = tpl.content.cloneNode(true);
  content.querySelectorAll('[data-action="openForm"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.form;
      Modal.close();
      handleQuickCreateSelection(target);
    });
  });
  Modal.open({ title:'Creacion rapida', content, okText:'Cerrar', onOk: () => true });
}

function handleQuickCreateSelection(form) {
  switch (form) {
    case 'producto-mp':
      sessionStorage.setItem('pendingProductModal', JSON.stringify({ tipo: 'MP' }));
      if (location.hash === '#/productos') {
        window.dispatchEvent(new CustomEvent('product-modal-pending'));
      } else {
        location.hash = '#/productos';
      }
      break;
    case 'producto-pt':
      sessionStorage.removeItem('pendingProductModal');
      sessionStorage.setItem('pendingRecipeModal', JSON.stringify({ createPT: true }));
      if (location.hash === '#/recetas') {
        window.dispatchEvent(new CustomEvent('recipe-pending-ready'));
      } else {
        location.hash = '#/recetas';
      }
      break;
    case 'receta':
      sessionStorage.setItem('pendingRecipeModal', '1');
      if (location.hash === '#/recetas') {
        window.dispatchEvent(new CustomEvent('recipe-pending-ready'));
      } else {
        location.hash = '#/recetas';
      }
      break;
    case 'planilla':
      location.hash = '#/planillas';
      break;
    case 'merma':
      location.hash = '#/inventario';
      break;
    default:
      break;
  }
}



