(() => {
  const money = (value) => (window.fmt ? fmt.money(value || 0) : `CRC ${Number(value || 0).toFixed(2)}`);
  const formatNumber = (value) => Number(value || 0).toLocaleString('es-CR');
  const renderTable = (target, columns, rows) => {
    target.innerHTML = '';
    target.appendChild(Table({ columns, rows }));
  };
  const showPlaceholder = (target, message) => {
    target.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = message;
    target.appendChild(p);
  };

  async function fetchResumen(params = {}) {
    const qs = new URLSearchParams();
    if (params.desde) qs.set('desde', params.desde);
    if (params.hasta) qs.set('hasta', params.hasta);
    if (params.top) qs.set('top', params.top);
    const suffix = qs.toString();
    return await fetchJSON(api(`/reportes/resumen-ventas${suffix ? `?${suffix}` : ''}`));
  }

  function renderResumen(root) {
    if (!root) return;
    root.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'grid gap-2';
    root.appendChild(wrapper);

    const filterCard = document.createElement('div');
    filterCard.className = 'card';
    const title = document.createElement('h3');
    title.textContent = 'Resumen de ventas';
    filterCard.appendChild(title);

    const form = document.createElement('form');
    form.className = 'form-grid';
    const desdeField = Field('Desde', Input({ name: 'desde', type: 'date' }));
    const hastaField = Field('Hasta', Input({ name: 'hasta', type: 'date' }));
    const topField = Field('Top registros', Input({ name: 'top', type: 'number', min: '1', placeholder: '10' }));
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const applyBtn = document.createElement('button');
    applyBtn.type = 'submit';
    applyBtn.className = 'btn-primary';
    applyBtn.textContent = 'Aplicar';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn';
    resetBtn.textContent = 'Limpiar';
    actions.append(applyBtn, resetBtn);
    form.append(desdeField, hastaField, topField, actions);
    filterCard.appendChild(form);
    wrapper.appendChild(filterCard);

    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'grid-2 gap-2';
    wrapper.appendChild(resultsGrid);

    const clientesCard = document.createElement('div');
    clientesCard.className = 'card';
    const clientesHeader = document.createElement('div');
    clientesHeader.className = 'toolbar';
    const clientesTitle = document.createElement('h4');
    clientesTitle.textContent = 'Ingresos por cliente';
    const clientesCount = document.createElement('span');
    clientesCount.className = 'muted';
    clientesHeader.append(clientesTitle, clientesCount);
    const clientesContent = document.createElement('div');
    clientesCard.append(clientesHeader, clientesContent);
    resultsGrid.appendChild(clientesCard);

    const productosCard = document.createElement('div');
    productosCard.className = 'card';
    const productosHeader = document.createElement('div');
    productosHeader.className = 'toolbar';
    const productosTitle = document.createElement('h4');
    productosTitle.textContent = 'Productos con mayores ventas';
    const productosCount = document.createElement('span');
    productosCount.className = 'muted';
    productosHeader.append(productosTitle, productosCount);
    const productosContent = document.createElement('div');
    productosCard.append(productosHeader, productosContent);
    resultsGrid.appendChild(productosCard);

    const loadData = async (params = {}) => {
      showPlaceholder(clientesContent, 'Cargando datos...');
      showPlaceholder(productosContent, 'Cargando datos...');
      try {
        const data = await fetchResumen(params);
        const clientes = Array.isArray(data?.clientes) ? data.clientes : [];
        const productos = Array.isArray(data?.productos) ? data.productos : [];

        renderTable(clientesContent, [
          { key: 'cliente_nombre', label: 'Cliente' },
          { key: 'facturas', label: 'Facturas', format: formatNumber },
          { key: 'unidades', label: 'Unidades', format: formatNumber },
          { key: 'total_crc', label: 'Total', format: money },
        ], clientes);
        renderTable(productosContent, [
          { key: 'producto_nombre', label: 'Producto' },
          { key: 'unidades', label: 'Unidades', format: formatNumber },
          { key: 'total_crc', label: 'Total', format: money },
        ], productos);

        clientesCount.textContent = clientes.length ? `${clientes.length} clientes` : 'Sin registros';
        productosCount.textContent = productos.length ? `${productos.length} productos` : 'Sin registros';
      } catch (err) {
        showPlaceholder(clientesContent, err?.message || 'No se pudo obtener el resumen');
        showPlaceholder(productosContent, err?.message || 'No se pudo obtener el resumen');
        clientesCount.textContent = '';
        productosCount.textContent = '';
        Toast(err?.message || 'No se pudo obtener el resumen', 'error');
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      loadData({
        desde: fd.get('desde') || undefined,
        hasta: fd.get('hasta') || undefined,
        top: fd.get('top') || undefined,
      });
    });

    resetBtn.addEventListener('click', () => {
      form.reset();
      loadData();
    });

    loadData();
  }

  window.renderResumen = renderResumen;
  window.dispatchEvent(new Event('resumen-ready'));
})();
