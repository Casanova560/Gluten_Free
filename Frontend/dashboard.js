(() => {
  const toNumber = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  const formatDateKey = (value) => {
    if (!value) return '';
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number') {
      return formatDateKey(new Date(value));
    }
    if (typeof value === 'string') {
      if (value.length >= 10) return value.slice(0, 10);
      return formatDateKey(new Date(value));
    }
    return formatDateKey(new Date(value));
  };

  const formatMonthKey = (value) => {
    const key = formatDateKey(value);
    return key ? key.slice(0, 7) : '';
  };

  const sumBy = (list, getter) => {
    return (list || []).reduce((acc, item) => acc + toNumber(getter(item)), 0);
  };

  const formatQty = (value) => toNumber(value).toFixed(2);

  const buildCard = (title) => {
    const card = document.createElement('div');
    card.className = 'card';
    const head = document.createElement('h3');
    head.textContent = title;
    const body = document.createElement('div');
    body.className = 'card-body';
    card.append(head, body);
    return { card, body };
  };

  const setLoading = (body) => {
    if (!body) return;
    body.innerHTML = '<p class="muted">Cargando...</p>';
  };

  const setEmpty = (body, message) => {
    if (!body) return;
    body.innerHTML = `<p class="muted">${message}</p>`;
  };

  const charts = {};

  const destroyChart = (key) => {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  };

  const createChart = (key, target, type, config) => {
    if (!target) return;
    if (!window.Chart) {
      setEmpty(target, 'Chart.js no disponible.');
      return;
    }
    destroyChart(key);
    target.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.height = 260;
    target.appendChild(canvas);
    charts[key] = new Chart(canvas, { type, ...config });
  };

  const ventaTotal = (venta) => {
    const direct = toNumber(venta?.total_crc ?? venta?.total ?? venta?.monto_total_crc ?? venta?.monto_crc);
    if (direct > 0) return direct;
    return sumBy(venta?.items || venta?.detalles || venta?.lineas || [], (item) => {
      const base = toNumber(item?.total_crc ?? item?.total ?? item?.subtotal);
      if (base > 0) return base;
      return toNumber(item?.cantidad ?? item?.qty ?? item?.unidades) * toNumber(item?.precio_unitario_crc ?? item?.precio_unitario ?? item?.precio);
    });
  };

  const compraTotal = (compra) => {
    const direct = toNumber(compra?.total_crc ?? compra?.monto_total_crc ?? compra?.total ?? compra?.monto);
    if (direct > 0) return direct;
    const items = compra?.items || compra?.detalles || compra?.lineas || [];
    if (!Array.isArray(items) || !items.length) return direct;
    return items.reduce((acc, item) => {
      const cantidad = toNumber(item?.cantidad ?? item?.qty ?? item?.unidades);
      const costo = toNumber(item?.costo_unitario_crc ?? item?.costo_unitario ?? item?.costo ?? item?.precio ?? 0);
      const descuento = toNumber(item?.descuento_crc ?? item?.descuento ?? 0);
      return acc + (cantidad * costo - descuento);
    }, 0);
  };

  const planillaTotal = (planilla) => {
    const direct = toNumber(planilla?.total_estimado_crc ?? planilla?.total_crc ?? planilla?.monto_total_crc ?? planilla?.total_planilla_crc ?? planilla?.total ?? 0);
    if (direct > 0) return direct;
    const detalles = Array.isArray(planilla?.detalles) ? planilla.detalles : [];
    if (!detalles.length) return direct;
    return detalles.reduce((acc, det) => acc + toNumber(det?.costo_total_crc ?? det?.total_crc ?? det?.total ?? 0), 0);
  };

  const aggregateByMonth = (list, dateGetter, valueGetter) => {
    const map = new Map();
    (list || []).forEach((item) => {
      const monthKey = formatMonthKey(dateGetter(item));
      if (!monthKey) return;
      const current = map.get(monthKey) || 0;
      map.set(monthKey, current + toNumber(valueGetter(item)));
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  };

  const aggregateVentasPorProducto = (ventas) => {
    const grouped = new Map();
    (ventas || []).forEach((venta) => {
      const items = venta?.items || venta?.detalles || venta?.lineas || [];
      items.forEach((item) => {
        const key = item?.producto_id ?? item?.producto_nombre ?? item?.nombre ?? 'desconocido';
        const nombre = item?.producto_nombre || item?.nombre || item?.producto || `Producto ${key}`;
        const row = grouped.get(key) || { nombre, cantidad: 0, total: 0 };
        row.nombre = nombre;
        row.cantidad += toNumber(item?.cantidad ?? item?.qty ?? item?.unidades);
        const totalItem = toNumber(item?.total_crc ?? item?.total ?? item?.subtotal);
        if (totalItem > 0) {
          row.total += totalItem;
        } else {
          const precio = toNumber(item?.precio_unitario_crc ?? item?.precio_unitario ?? item?.precio);
          row.total += precio * toNumber(item?.cantidad ?? item?.qty ?? item?.unidades);
        }
        grouped.set(key, row);
      });
    });
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  };

  const aggregateVentasPorCliente = (ventas) => {
    const grouped = new Map();
    (ventas || []).forEach((venta) => {
      const key = venta?.cliente_id ?? venta?.cliente_nombre ?? venta?.cliente ?? 'desconocido';
      const nombre = venta?.cliente_nombre || venta?.cliente || `Cliente ${key}`;
      const row = grouped.get(key) || { nombre, ventas: 0, total: 0 };
      row.nombre = nombre;
      row.ventas += 1;
      row.total += ventaTotal(venta);
      grouped.set(key, row);
    });
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  };

  const renderTrendChart = (target, { ventas, compras, gastos }) => {
    if (!target) return;
    const ventasMes = aggregateByMonth(ventas, (v) => v?.fecha || v?.fecha_emision || v?.created_at || v?.createdAt, ventaTotal);
    const comprasMes = aggregateByMonth(compras, (c) => c?.fecha || c?.fecha_documento || c?.created_at, compraTotal);
    const gastosMes = aggregateByMonth(gastos, (g) => g?.fecha || g?.fecha_gasto || g?.created_at, (g) => toNumber(g?.monto_crc || g?.monto || 0));
    const labels = Array.from(new Set([...ventasMes.map(([m]) => m), ...comprasMes.map(([m]) => m), ...gastosMes.map(([m]) => m)])).sort();
    if (!labels.length) {
      setEmpty(target, 'No hay datos en el rango seleccionado.');
      return;
    }
    const ventasMap = new Map(ventasMes);
    const comprasMap = new Map(comprasMes);
    const gastosMap = new Map(gastosMes);
    const dataVentas = labels.map((label) => toNumber(ventasMap.get(label)));
    const dataCompras = labels.map((label) => toNumber(comprasMap.get(label)));
    const dataGastos = labels.map((label) => toNumber(gastosMap.get(label)));
    const moneyFormatter = (value) => new Intl.NumberFormat('es-CR', { style:'currency', currency:'CRC', maximumFractionDigits:0 }).format(value);
    createChart('trend', target, 'line', {
      data: {
        labels,
        datasets: [
          { label: 'Ventas', data: dataVentas, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.15)', tension: 0.25, fill: true },
          { label: 'Compras', data: dataCompras, borderColor: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.15)', tension: 0.25, fill: true },
          { label: 'Gastos', data: dataGastos, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.15)', tension: 0.25, fill: true }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            ticks: {
              callback: (value) => moneyFormatter(value)
            }
          }
        }
      }
    });
  };

  const renderTopProductosChart = (target, ventas) => {
    if (!target) return;
    const rows = aggregateVentasPorProducto(ventas).slice(0, 8);
    if (!rows.length) {
      setEmpty(target, 'No hay ventas registradas en el rango.');
      return;
    }
    createChart('productos', target, 'bar', {
      data: {
        labels: rows.map((row) => row.nombre),
        datasets: [{
          label: 'Total vendido (CRC)',
          data: rows.map((row) => row.total),
          backgroundColor: '#38bdf8'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              callback: (value, idx) => fmt.money(rows[idx].total)
            }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  };

  const renderTopClientesChart = (target, ventas) => {
    if (!target) return;
    const rows = aggregateVentasPorCliente(ventas).slice(0, 8);
    if (!rows.length) {
      setEmpty(target, 'No hay ventas asociadas a clientes en el rango.');
      return;
    }
    createChart('clientes', target, 'bar', {
      data: {
        labels: rows.map((row) => row.nombre),
        datasets: [{
          label: 'Total facturado (CRC)',
          data: rows.map((row) => row.total),
          backgroundColor: '#a855f7'
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        }
      }
    });
  };

  const renderPlanillasChart = (target, summaryEl, planillas) => {
    if (!target) return;
    if (!Array.isArray(planillas) || !planillas.length) {
      setEmpty(target, 'No hay planillas en el rango seleccionado.');
      if (summaryEl) summaryEl.innerHTML = '';
      return;
    }
    const sorted = [...planillas].sort((a, b) => (a.semana_inicio || '').localeCompare(b.semana_inicio || ''));
    const labels = sorted.map((p) => fmt.date(p.semana_inicio));
    const horas = sorted.map((p) => toNumber(p.horas_reg) + toNumber(p.horas_extra) + toNumber(p.horas_doble) + toNumber(p.horas_feriado));
    const totales = sorted.map((p) => planillaTotal(p));
    createChart('planillas', target, 'bar', {
      data: {
        labels,
        datasets: [
          { label: 'Horas registradas', data: horas, backgroundColor: 'rgba(59, 130, 246, 0.35)', yAxisID: 'y1' },
          { label: 'Costo estimado (CRC)', data: totales, backgroundColor: 'rgba(16, 185, 129, 0.55)', yAxisID: 'y' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            position: 'left',
            ticks: {
              callback: (value) => fmt.money(value)
            }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (value) => formatQty(value) + 'h'
            }
          }
        }
      }
    });

    if (summaryEl) {
      const totalHoras = horas.reduce((acc, value) => acc + value, 0);
      const totalMonto = totales.reduce((acc, value) => acc + value, 0);
      const totalPlanillas = planillas.length;
      const totalColaboradores = planillas.reduce((acc, planilla) => acc + toNumber(planilla.colaboradores || 0), 0);
      const latest = [...sorted].sort((a, b) => (b.semana_inicio || '').localeCompare(a.semana_inicio || ''))[0];
      const periodo = formatDateKey(latest?.semana_inicio || latest?.periodo_inicio || latest?.fecha);
      summaryEl.innerHTML = `
        <p><strong>Planillas en rango:</strong> ${totalPlanillas}</p>
        <p><strong>Colaboradores cubiertos:</strong> ${totalColaboradores}</p>
        <p><strong>Horas registradas:</strong> ${formatQty(totalHoras)}</p>
        <p><strong>Monto acumulado:</strong> ${fmt.money(totalMonto)}</p>
        ${periodo ? `<p><strong>Ultimo periodo:</strong> ${periodo}</p>` : ''}
      `;
    }
  };

  const renderContabilidad = (body, { ventas, compras, mermas, planillas, gastos, cxc, cxp }) => {
    if (!body) return;
    const totalVentas = sumBy(ventas, ventaTotal);
    const totalCompras = sumBy(compras, compraTotal);
    const totalMermas = sumBy(mermas, (row) => toNumber(row?.monto_crc ?? row?.total_crc ?? 0));
    const totalPlanillas = sumBy(planillas, planillaTotal);
    const totalGastos = sumBy(gastos, (row) => toNumber(row?.monto_crc ?? row?.monto ?? 0));
    const cuentasPorCobrar = sumBy(cxc, (row) => toNumber(row?.saldo_crc ?? row?.saldo ?? 0));
    const cuentasPorPagar = sumBy(cxp, (row) => toNumber(row?.saldo_crc ?? row?.saldo ?? 0));
    const margenOperativo = totalVentas - totalCompras - totalMermas - totalPlanillas - totalGastos;

    body.innerHTML = `
      <p><strong>Ingresos</strong>: ${fmt.money(totalVentas)}</p>
      <p><strong>Costos directos</strong>: ${fmt.money(totalCompras + totalMermas)}</p>
      <p><strong>Nomina registrada</strong>: ${fmt.money(totalPlanillas)}</p>
      <p><strong>Gastos</strong>: ${fmt.money(totalGastos)}</p>
      <p><strong>Resultado operativo</strong>: ${fmt.money(margenOperativo)}</p>
      <p><strong>CxC</strong>: ${fmt.money(cuentasPorCobrar)} | <strong>CxP</strong>: ${fmt.money(cuentasPorPagar)}</p>
    `;
  };

  const renderDashboard = (root) => {
    if (!root) return;
    root.innerHTML = '';

    const todayStr = today();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const defaultDesde = formatDateKey(start);

    const form = document.createElement('form');
    form.className = 'panel filter-bar';
    const desdeInput = Input({ name: 'desde', type: 'date', value: defaultDesde });
    const hastaInput = Input({ name: 'hasta', type: 'date', value: todayStr });
    const desdeField = Field('Desde', desdeInput);
    const hastaField = Field('Hasta', hastaInput);
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Actualizar';
    actions.append(submitBtn);
    form.append(desdeField, hastaField, actions);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'grid gap-2 dashboard-cards';

    const ventasTrendCard = buildCard('Evolucion de ventas, compras y gastos');
    const trendArea = document.createElement('div'); trendArea.className = 'chart-area'; ventasTrendCard.body.appendChild(trendArea);

    const productosCard = buildCard('Top productos vendidos');
    const productosArea = document.createElement('div'); productosArea.className = 'chart-area'; productosCard.body.appendChild(productosArea);

    const clientesCard = buildCard('Clientes mas relevantes');
    const clientesArea = document.createElement('div'); clientesArea.className = 'chart-area'; clientesCard.body.appendChild(clientesArea);

    const planillasCard = buildCard('Planillas semanales');
    const planillasArea = document.createElement('div'); planillasArea.className = 'chart-area';
    const planillasSummary = document.createElement('div'); planillasSummary.className = 'planillas-summary';
    planillasCard.body.append(planillasArea, planillasSummary);

    const contabilidadCard = buildCard('Resumen contable');

    cardsWrap.append(
      ventasTrendCard.card,
      productosCard.card,
      clientesCard.card,
      planillasCard.card,
      contabilidadCard.card
    );

    root.append(form, cardsWrap);

    let currentToken = 0;

    const loadData = async () => {
      const token = ++currentToken;
      const desde = desdeInput.value;
      const hasta = hastaInput.value;

      setLoading(trendArea);
      setLoading(productosArea);
      setLoading(clientesArea);
      setLoading(planillasArea);
      setLoading(contabilidadCard.body);
      planillasSummary.innerHTML = '';

      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      params.set('include', 'items');
      const ventasUrl = params.toString() ? `/ventas?${params.toString()}` : '/ventas';

      try {
        const [ventasRaw, comprasRaw, mermasRaw, planillasRaw, cxcRaw, cxpRaw, gastosRaw] = await Promise.all([
          fetchJSON(api(ventasUrl)).catch(() => []),
          fetchJSON(api('/compras')).catch(() => []),
          fetchJSON(api('/inventario/mermas')).catch(() => []),
          fetchJSON(api('/planillas')).catch(() => []),
          fetchJSON(api('/finanzas/cxc')).catch(() => []),
          fetchJSON(api('/finanzas/cxp')).catch(() => []),
          fetchJSON(api('/finanzas/gastos')).catch(() => [])
        ]);

        if (token !== currentToken) return;

        const ventas = ventasRaw.filter((venta) => {
          const key = formatDateKey(venta?.fecha || venta?.fecha_emision || venta?.created_at || venta?.createdAt);
          if (!key) return true;
          return (!desde || key >= desde) && (!hasta || key <= hasta);
        });
        const compras = comprasRaw.filter((compra) => {
          const key = formatDateKey(compra?.fecha || compra?.fecha_documento || compra?.created_at);
          if (!key) return true;
          return (!desde || key >= desde) && (!hasta || key <= hasta);
        });
        const mermas = mermasRaw.filter((merma) => {
          const key = formatDateKey(merma?.fecha || merma?.created_at);
          if (!key) return true;
          return (!desde || key >= desde) && (!hasta || key <= hasta);
        });
        const planillas = planillasRaw.filter((p) => {
          const key = formatDateKey(p?.semana_inicio || p?.periodo_inicio || p?.fecha || p?.created_at);
          if (!key) return true;
          return (!desde || key >= desde) && (!hasta || key <= hasta);
        });
        const gastosFiltrados = gastosRaw.filter((row) => {
          const key = formatDateKey(row?.fecha || row?.fecha_gasto || row?.created_at);
          if (!key) return true;
          return (!desde || key >= desde) && (!hasta || key <= hasta);
        });

        renderTrendChart(trendArea, { ventas, compras, gastos: gastosFiltrados });
        renderTopProductosChart(productosArea, ventas);
        renderTopClientesChart(clientesArea, ventas);
        renderPlanillasChart(planillasArea, planillasSummary, planillas);
        renderContabilidad(contabilidadCard.body, { ventas, compras, mermas, planillas, gastos: gastosFiltrados, cxc: cxcRaw, cxp: cxpRaw });
      } catch (error) {
        if (token !== currentToken) return;
        console.error(error);
        setEmpty(trendArea, 'No se pudo cargar la informacion.');
        setEmpty(productosArea, 'No se pudo cargar la informacion.');
        setEmpty(clientesArea, 'No se pudo cargar la informacion.');
        setEmpty(planillasArea, 'No se pudo cargar la informacion.');
        setEmpty(contabilidadCard.body, 'No se pudo cargar la informacion.');
        Toast('No se pudo cargar el dashboard', 'error');
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadData();
    });

    loadData();
  };

  window.renderDashboard = renderDashboard;
  window.dispatchEvent(new Event('dashboard-ready'));
})();

