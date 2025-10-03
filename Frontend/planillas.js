(() => {
  const money = (value) => (window.fmt ? fmt.money(value || 0) : `₡${Number(value || 0).toFixed(2)}`);
  const fmtDate = (value) => {
    if (!value) return '-';
    if (window.fmt?.date) return fmt.date(value);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
  };
  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const calcLineTotal = (line) => {
    const tarifa = num(line.tarifa_base_crc || line.tarifaBase);
    return tarifa * num(line.horas) + tarifa * 1.5 * num(line.horas_extra || line.horasExtra) + tarifa * 3 * num(line.horas_doble || line.horasDoble);
  };
  const normalizeLine = (line) => ({
    id: line.id,
    empleado_id: line.empleado_id ?? line.empleadoId ?? null,
    empleado_nombre: line.empleado_nombre || null,
    tarifa_base_crc: num(line.tarifa_base_crc || line.tarifaBase),
    horas: num(line.horas),
    horas_extra: num(line.horas_extra || line.horasExtra),
    horas_doble: num(line.horas_doble || line.horasDoble),
    total_crc: num(line.total_crc || line.total || 0),
  });

  const state = { dias: [] };
  let rootEl = null;
  let listEl = null;
  let totalGeneralEl = null;

  async function ensureEmpleados() {
    if (Array.isArray(Store?.state?.empleados) && Store.state.empleados.length) return;
    try {
      const empleados = await fetchJSON(api('/contactos/empleados'));
      if (Array.isArray(empleados)) Store.set({ empleados });
    } catch (err) {
      console.error('No se pudieron cargar empleados', err);
    }
  }

  async function fetchDias() {
    return await fetchJSON(api('/planillas/dias'));
  }

  async function fetchDia(id) {
    return await fetchJSON(api(`/planillas/dias/${id}`));
  }

  async function createDia(fecha) {
    return await fetchJSON(api('/planillas/dias'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha }),
    });
  }

  async function deleteDia(id) {
    return await fetchJSON(api(`/planillas/dias/${id}`), { method: 'DELETE' });
  }

  async function persistLinea(day, line) {
    if (!line.empleado_id) return false;
    const payload = {
      empleado_id: line.empleado_id,
      tarifa_base_crc: num(line.tarifa_base_crc),
      horas: num(line.horas),
      horas_extra: num(line.horas_extra),
      horas_doble: num(line.horas_doble),
    };
    if (line.id) {
      const res = await fetchJSON(api(`/planillas/lineas/${line.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      line.total_crc = num(res?.total_crc ?? calcLineTotal(line));
    } else {
      const res = await fetchJSON(api(`/planillas/dias/${day.id}/lineas`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      line.id = res?.id;
      line.total_crc = num(res?.total_crc ?? calcLineTotal(line));
    }
    return true;
  }

  async function deleteLinea(id) {
    return await fetchJSON(api(`/planillas/lineas/${id}`), { method: 'DELETE' });
  }

  function updateDayTotal(day) {
    const total = Array.isArray(day.lineas) ? day.lineas.reduce((sum, line) => sum + calcLineTotal(line), 0) : num(day.total_crc);
    day.total_crc = total;
    if (day._dom?.total) day._dom.total.textContent = `Total del día: ${money(total)}`;
    updateGrandTotal();
  }

  function updateGrandTotal() {
    const total = state.dias.reduce((sum, d) => sum + num(d.total_crc), 0);
    if (totalGeneralEl) totalGeneralEl.textContent = money(total);
  }

  function renderDays() {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!state.dias.length) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<p class="muted">No hay días registrados. Usa "Crear día".</p>';
      listEl.appendChild(card);
      updateGrandTotal();
      return;
    }
    state.dias.forEach((day) => {
      listEl.appendChild(renderDayCard(day));
    });
    updateGrandTotal();
  }

  function renderDayCard(day) {
    const card = document.createElement('div');
    card.className = 'card planilla-dia';

    const header = document.createElement('div');
    header.className = 'toolbar';
    const title = document.createElement('strong');
    title.textContent = fmtDate(day.fecha);
    header.appendChild(title);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Eliminar día';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Eliminar registros del ${fmtDate(day.fecha)}?`)) return;
      try {
        await deleteDia(day.id);
        state.dias = state.dias.filter((d) => d !== day);
        renderDays();
        Toast('Día eliminado', 'success');
      } catch (err) {
        Toast(err?.message || 'No se pudo eliminar el día', 'error');
      }
    });
    header.appendChild(deleteBtn);
    card.appendChild(header);

    const totalInfo = document.createElement('div');
    totalInfo.className = 'muted';
    totalInfo.textContent = `Total del día: ${money(day.total_crc || 0)}`;
    card.appendChild(totalInfo);

    const body = document.createElement('div');
    body.className = 'table-wrap';
    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn';
    addBtn.textContent = '+ Agregar empleado';
    addBtn.addEventListener('click', () => {
      if (!Array.isArray(day.lineas)) {
        Toast('Espera a que termine de cargar el día', 'info');
        return;
      }
      day.lineas.push({ empleado_id: null, tarifa_base_crc: 0, horas: 0, horas_extra: 0, horas_doble: 0, total_crc: 0 });
      renderLines(day);
    });
    actions.appendChild(addBtn);
    card.appendChild(actions);

    day._dom = { title, total: totalInfo, body, addBtn };

    renderLines(day);
    if (day.lineas == null) reloadDay(day);

    return card;
  }

  function renderLines(day) {
    const body = day._dom?.body;
    if (!body) return;
    body.innerHTML = '';

    if (day.lineas == null) {
      body.innerHTML = '<p class="muted">Cargando...</p>';
      return;
    }

    if (!day.lineas.length) {
      body.innerHTML = '<p class="muted">Sin registros. Usa "Agregar empleado".</p>';
      updateDayTotal(day);
      return;
    }

    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = '<thead><tr><th>Empleado</th><th>Tarifa base</th><th>Horas</th><th>Extras (1.5x)</th><th>Extra doble (1.5x*2)</th><th>Total</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');
    day.lineas.forEach((line) => {
      tbody.appendChild(renderLineRow(day, line));
    });
    table.appendChild(tbody);
    body.appendChild(table);
    updateDayTotal(day);
  }

  function renderLineRow(day, line) {
    const tr = document.createElement('tr');

    const empleados = Store?.state?.empleados || [];

    const empTd = document.createElement('td');
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">Seleccione…</option>';
    empleados.forEach((emp) => {
      const opt = document.createElement('option');
      opt.value = String(emp.id);
      opt.textContent = emp.nombre || `#${emp.id}`;
      if (line.empleado_id && Number(line.empleado_id) === Number(emp.id)) opt.selected = true;
      sel.appendChild(opt);
    });
    empTd.appendChild(sel);
    tr.appendChild(empTd);

    const tarifaTd = document.createElement('td');
    const tarifaInput = document.createElement('input');
    tarifaInput.type = 'number';
    tarifaInput.step = '0.01';
    tarifaInput.min = '0';
    tarifaInput.value = line.tarifa_base_crc ? String(line.tarifa_base_crc) : '';
    tarifaTd.appendChild(tarifaInput);
    tr.appendChild(tarifaTd);

    const horasTd = document.createElement('td');
    const horasInput = document.createElement('input');
    horasInput.type = 'number';
    horasInput.step = '0.01';
    horasInput.min = '0';
    horasInput.value = line.horas ? String(line.horas) : '0';
    horasTd.appendChild(horasInput);
    tr.appendChild(horasTd);

    const extraTd = document.createElement('td');
    const extraInput = document.createElement('input');
    extraInput.type = 'number';
    extraInput.step = '0.01';
    extraInput.min = '0';
    extraInput.value = line.horas_extra ? String(line.horas_extra) : '0';
    extraTd.appendChild(extraInput);
    tr.appendChild(extraTd);

    const dobleTd = document.createElement('td');
    const dobleInput = document.createElement('input');
    dobleInput.type = 'number';
    dobleInput.step = '0.01';
    dobleInput.min = '0';
    dobleInput.value = line.horas_doble ? String(line.horas_doble) : '0';
    dobleTd.appendChild(dobleInput);
    tr.appendChild(dobleTd);

    const totalTd = document.createElement('td');
    const setTotalText = () => {
      totalTd.textContent = money(line.total_crc ?? calcLineTotal(line));
    };
    setTotalText();
    tr.appendChild(totalTd);

    const delTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Eliminar línea';
    delBtn.addEventListener('click', async () => {
      if (line.id) {
        try {
          await deleteLinea(line.id);
        } catch (err) {
          Toast(err?.message || 'No se pudo eliminar la línea', 'error');
          return;
        }
      }
      day.lineas = day.lineas.filter((l) => l !== line);
      renderLines(day);
      Toast('Registro eliminado', 'success');
    });
    delTd.appendChild(delBtn);
    tr.appendChild(delTd);

    const disableInputs = (disabled) => {
      tarifaInput.disabled = disabled;
      horasInput.disabled = disabled;
      extraInput.disabled = disabled;
      dobleInput.disabled = disabled;
    };
    disableInputs(!line.empleado_id);

    const handlePersist = async (after) => {
      try {
        const ok = await persistLinea(day, line);
        if (!ok) return;
        setTotalText();
        updateDayTotal(day);
        if (after) after();
      } catch (err) {
        Toast(err?.message || 'No se pudo guardar', 'error');
        await reloadDay(day);
      }
    };

    sel.addEventListener('change', async () => {
      const empId = sel.value ? Number(sel.value) : null;
      if (!empId) {
        if (line.id) {
          sel.value = line.empleado_id ? String(line.empleado_id) : '';
        }
        Toast('Selecciona un empleado válido', 'error');
        return;
      }
      line.empleado_id = empId;
      const emp = empleados.find((e) => Number(e.id) === empId);
      if (!line.id || !line.tarifa_base_crc) {
        line.tarifa_base_crc = num(emp?.tarifa_hora_crc);
        tarifaInput.value = line.tarifa_base_crc ? String(line.tarifa_base_crc) : '';
      }
      line.empleado_nombre = emp?.nombre || null;
      disableInputs(false);
      await handlePersist();
    });

    tarifaInput.addEventListener('change', async () => {
      const prev = line.tarifa_base_crc;
      line.tarifa_base_crc = num(tarifaInput.value);
      if (!line.empleado_id) {
        line.tarifa_base_crc = prev;
        tarifaInput.value = prev ? String(prev) : '';
        Toast('Selecciona un empleado primero', 'error');
        return;
      }
      await handlePersist();
    });

    const bindHours = (input, key) => {
      input.addEventListener('change', async () => {
        const prev = line[key];
        line[key] = num(input.value);
        if (!line.empleado_id) {
          line[key] = prev;
          input.value = String(prev || 0);
          Toast('Selecciona un empleado primero', 'error');
          return;
        }
        await handlePersist();
      });
    };
    bindHours(horasInput, 'horas');
    bindHours(extraInput, 'horas_extra');
    bindHours(dobleInput, 'horas_doble');

    return tr;
  }

  async function reloadDay(day) {
    try {
      const data = await fetchDia(day.id);
      day.fecha = data.fecha;
      day.nota = data.nota;
      day.lineas = Array.isArray(data.lineas) ? data.lineas.map(normalizeLine) : [];
      if (day._dom?.title) day._dom.title.textContent = fmtDate(day.fecha);
      renderLines(day);
    } catch (err) {
      day.lineas = [];
      renderLines(day);
      Toast(err?.message || 'No se pudo cargar el día', 'error');
    }
  }

  async function loadDias() {
    try {
      const dias = await fetchDias();
      state.dias = Array.isArray(dias)
        ? dias.map((d) => ({ id: d.id, fecha: d.fecha, total_crc: num(d.total_crc), lineas: null }))
        : [];
      renderDays();
    } catch (err) {
      listEl.innerHTML = `<div class="card"><p class="muted">${err?.message || 'No se pudieron cargar las planillas'}</p></div>`;
    }
  }

  function renderPlanillas(root) {
    rootEl = root;
    root.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'grid gap-2';
    root.appendChild(wrapper);

    const header = document.createElement('div');
    header.className = 'card';
    const title = document.createElement('h3');
    title.textContent = 'Planillas por día';
    header.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'toolbar';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = today();
    controls.appendChild(dateInput);
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-primary';
    addBtn.textContent = 'Crear día';
    addBtn.addEventListener('click', async () => {
      const fecha = dateInput.value || today();
      try {
        const created = await createDia(fecha);
        const day = { id: created.id, fecha: created.fecha || fecha, total_crc: 0, lineas: null };
        state.dias.unshift(day);
        renderDays();
        Toast('Día creado', 'success');
      } catch (err) {
        Toast(err?.message || 'No se pudo crear el día', 'error');
      }
    });
    controls.appendChild(addBtn);
    header.appendChild(controls);
    wrapper.appendChild(header);

    listEl = document.createElement('div');
    listEl.className = 'grid gap-2';
    wrapper.appendChild(listEl);

    const footer = document.createElement('div');
    footer.className = 'toolbar';
    footer.textContent = 'Total general: ';
    totalGeneralEl = document.createElement('strong');
    totalGeneralEl.textContent = money(0);
    footer.appendChild(totalGeneralEl);
    wrapper.appendChild(footer);

    ensureEmpleados().finally(loadDias);
  }

  window.renderPlanillas = renderPlanillas;
  window.dispatchEvent(new Event('planillas-ready'));
})();
