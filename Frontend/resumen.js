(() => {
  const money = (value) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(value || 0));
  const formatNumber = (value) => Number(value || 0).toLocaleString('es-CR');

  function renderRows(tbody, rows, columns) {
    tbody.innerHTML = '';
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length;
      td.className = 'px-4 py-6 text-center text-slate-400';
      td.textContent = 'Sin datos para este rango.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.className = 'odd:bg-slate-50';
      columns.forEach((col) => {
        const td = document.createElement('td');
        td.className = col.align === 'right'
          ? 'px-4 py-2 text-right tabular-nums text-slate-700'
          : 'px-4 py-2 text-left text-slate-700';
        const value = typeof col.render === 'function' ? col.render(row) : row[col.key];
        td.textContent = value ?? '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function showSkeleton(tbody, cols) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = cols;
    td.className = 'px-4 py-6 text-center text-slate-400';
    td.textContent = 'Cargando...';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

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
    root.classList.add('resumen-view');
    root.innerHTML = `
      <div class="grid gap-6">
        <header class="bg-white/70 dark:bg-slate-900/70 backdrop-blur shadow-sm rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-5">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Resumen de ventas</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">Totales facturados por cliente y por producto según el rango seleccionado.</p>
          </div>
          <form id="resumenFilterForm" class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Desde
              <input name="desde" type="date" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            </label>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Hasta
              <input name="hasta" type="date" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            </label>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Top registros
              <input name="top" type="number" min="1" placeholder="10" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            </label>
            <div class="flex gap-2">
              <button type="submit" class="flex-1 inline-flex justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2">Aplicar</button>
              <button type="button" id="resumenResetBtn" class="inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">Limpiar</button>
            </div>
          </form>
        </header>

        <section class="grid gap-6 lg:grid-cols-2">
          <article class="bg-white dark:bg-slate-900 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <header class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Ingresos por cliente</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Ordenado por mayor facturación.</p>
              </div>
              <span id="resumenClientesCount" class="text-sm text-slate-500"></span>
            </header>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                <thead class="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Cliente</th>
                    <th class="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Facturas</th>
                    <th class="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Unidades</th>
                    <th class="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Total CRC</th>
                  </tr>
                </thead>
                <tbody id="resumenClientesTBody" class="divide-y divide-slate-100 dark:divide-slate-800"></tbody>
              </table>
            </div>
          </article>

          <article class="bg-white dark:bg-slate-900 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <header class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Ingresos por producto</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Incluye unidades vendidas y total.</p>
              </div>
              <span id="resumenProductosCount" class="text-sm text-slate-500"></span>
            </header>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                <thead class="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Producto</th>
                    <th class="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Unidades</th>
                    <th class="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Total CRC</th>
                  </tr>
                </thead>
                <tbody id="resumenProductosTBody" class="divide-y divide-slate-100 dark:divide-slate-800"></tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    `;

    const form = root.querySelector('#resumenFilterForm');
    const resetBtn = root.querySelector('#resumenResetBtn');
    const clientesTBody = root.querySelector('#resumenClientesTBody');
    const productosTBody = root.querySelector('#resumenProductosTBody');
    const clientesCount = root.querySelector('#resumenClientesCount');
    const productosCount = root.querySelector('#resumenProductosCount');

    const loadData = async (params = {}) => {
      showSkeleton(clientesTBody, 4);
      showSkeleton(productosTBody, 3);
      try {
        const data = await fetchResumen(params);
        const clientes = Array.isArray(data?.clientes) ? data.clientes : [];
        const productos = Array.isArray(data?.productos) ? data.productos : [];

        renderRows(clientesTBody, clientes, [
          { key: 'cliente_nombre' },
          { key: 'facturas', align: 'right', render: (row) => formatNumber(row.facturas) },
          { key: 'unidades', align: 'right', render: (row) => formatNumber(row.unidades) },
          { key: 'total_crc', align: 'right', render: (row) => money(row.total_crc) },
        ]);
        renderRows(productosTBody, productos, [
          { key: 'producto_nombre' },
          { key: 'unidades', align: 'right', render: (row) => formatNumber(row.unidades) },
          { key: 'total_crc', align: 'right', render: (row) => money(row.total_crc) },
        ]);

        clientesCount.textContent = `${clientes.length} clientes`;
        productosCount.textContent = `${productos.length} productos`;
      } catch (err) {
        renderRows(clientesTBody, [], [
          { key: 'cliente_nombre' },
          { key: 'facturas', align: 'right' },
          { key: 'unidades', align: 'right' },
          { key: 'total_crc', align: 'right' },
        ]);
        renderRows(productosTBody, [], [
          { key: 'producto_nombre' },
          { key: 'unidades', align: 'right' },
          { key: 'total_crc', align: 'right' },
        ]);
        clientesCount.textContent = productosCount.textContent = '';
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
