(() => {
  const FACTOR_EXTRA_DEFAULT = 1.5;
  const FACTOR_DOBLE_DEFAULT = 2.0;
  const FACTOR_FERIADO_DEFAULT = 2.0;

  const toNumber = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  const formatHours = (value) => toNumber(value).toFixed(2);

  const safeDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  const labelForDetalle = (detalle) => detalle?.empleado_nombre || detalle?.persona || `Registro #${detalle?.id ?? ''}`;

  const computeHorasCost = (tarifa, horas, factors) => (
    tarifa * horas.reg +
    tarifa * factors.extra * horas.extra +
    tarifa * factors.doble * horas.doble +
    tarifa * factors.feriado * horas.feriado
  );
  const refreshEmpleadoOptions = (selectEl, selectedId = null) => {
    if (!selectEl) return;
    const current = String(selectedId ?? selectEl.value ?? '');
    selectEl.innerHTML = '';
    const ph = document.createElement('option'); ph.value=''; ph.textContent='Seleccione colaborador'; selectEl.appendChild(ph);
    (Store?.state?.empleados || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = String(e.id);
      opt.textContent = e.nombre || ('#' + e.id);
      if (current && String(e.id) === current) opt.selected = true;
      selectEl.appendChild(opt);
    });
  };

  const openQuickEmpleado = async (onSaved) => {
    const form = document.createElement('form'); form.className='form-grid';
    const nombre = Field('Nombre', Input({ name: 'nombre', required: true }));
    const numdoc = Field('Documento (opcional)', Input({ name: 'num_doc', placeholder: 'CED / PASS' }));
    const tel = Field('Telefono', Input({ name: 'telefono', placeholder: '' }));
    const tarifa = Field('Tarifa x hora (CRC)', Input({ name: 'tarifa_hora_crc', type: 'number', step: '0.01', required: true }));
    form.append(nombre, numdoc, tel, tarifa);
    Modal.open({ title: 'Nuevo empleado', content: form, onOk: async () => {
      const payload = Object.fromEntries(new FormData(form).entries());
      if (!payload.nombre) { Toast('Nombre requerido','error'); return false; }
      payload.tarifa_hora_crc = Number(payload.tarifa_hora_crc || 0);
      try {
        await fetchJSON(api('/contactos/empleados'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const empleados = await fetchJSON(api('/contactos/empleados')).catch(()=>[]);
        Store.set({ empleados });
        Toast('Empleado creado', 'success');
        if (typeof onSaved === 'function') onSaved();
      } catch (e) { Toast(e?.message || 'Error al crear empleado','error'); return false; }
    }});
  };

  const getWeekDates = (planilla) => {
    const baseStr = safeDate(planilla?.semana_inicio) || today();
    const base = new Date(baseStr);
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(base);
      d.setDate(base.getDate() + index);
      return d.toISOString().slice(0, 10);
    });
  };

  
  function getWeekStartDate(dateStr) {
    const d = new Date(safeDate(dateStr) || today());
    const wd = d.getDay(); // 0=Sun..6=Sat
    const delta = (wd + 6) % 7; // move to Monday
    d.setDate(d.getDate() - delta);
    return d.toISOString().slice(0,10);
  }
const clampDateToWeek = (planilla, target) => {
    if (!planilla) return safeDate(target) || today();
    const dates = getWeekDates(planilla);
    const normalized = safeDate(target) || dates[0];
    if (dates.includes(normalized)) return normalized;
    if (normalized < dates[0]) return dates[0];
    return dates[dates.length - 1];
  };

  const renderPlanillas = (root) => {
    if (!root) return;
    root.innerHTML = '';

    const state = {
      planillas: [],
      selectedId: null,
      selectedDate: today(),
      detalle: null,
      filterMonth: ''
    };

    const detailState = {
      data: null,
      factors: {
        extra: FACTOR_EXTRA_DEFAULT,
        doble: FACTOR_DOBLE_DEFAULT,
        feriado: FACTOR_FERIADO_DEFAULT
      },
      weekDates: [],
      rowStates: [],
      newRows: [],
      weekTabButtons: [],
      dateInput: null,
      tbody: null,
      dailySummaryEl: null
    };

    const topPanel = document.createElement('div');
    topPanel.className = 'panel';
    topPanel.innerHTML = `
      <h3>Planillas</h3>
      <div class="form-grid">
        <label class="field">
          <span>Semana (inicio)</span>
          <input name="semana_inicio" type="date" required>
        </label>
        <label class="field">
          <span>Nota</span>
          <input name="nota" placeholder="Opcional">
        </label>
        <label class="field">
          <span>Factor extra</span>
          <input name="factor_extra" type="number" step="0.01" value="${FACTOR_EXTRA_DEFAULT}">
        </label>
        <label class="field">
          <span>Factor doble</span>
          <input name="factor_doble" type="number" step="0.01" value="${FACTOR_DOBLE_DEFAULT}">
        </label>
        <label class="field">
          <span>Factor feriado</span>
          <input name="factor_feriado" type="number" step="0.01" value="${FACTOR_FERIADO_DEFAULT}">
        </label>
        <div class="form-actions">
          <button type="button" class="btn-primary" data-action="crear">Crear planilla</button>
        </div>
      </div>
      <div class="subpanel" style="margin-top:12px">
        <h4>Filtrar por mes</h4>
        <div class="form-grid">
          <label class="field">
            <span>Mes</span>
            <input name="f_mes" type="month">
          </label>
          <div class="form-actions">
            <button type="button" class="btn" data-action="filtrar">Filtrar</button>
            <button type="button" class="btn" data-action="limpiar">Limpiar</button>
          </div>
        </div>
      </div>
    `;
    const semanaInput = topPanel.querySelector('input[name="semana_inicio"]');
    if (semanaInput && !semanaInput.value) semanaInput.value = today();
    root.appendChild(topPanel);

    const infoBanner = document.createElement('div'); infoBanner.className = 'info-banner';
    infoBanner.innerHTML = "<p><strong>Como funciona:</strong> crea la planilla semanal con la fecha de inicio (lunes) y los factores de horas extra. Luego usa las pestanas de cada dia para registrar las horas de cada colaborador; la planilla calcula los montos automaticamente.</p>";
    root.appendChild(infoBanner);

    const layout = document.createElement('div');
    layout.className = 'grid cols-2 gap-2 planillas-layout';
    const listPanel = document.createElement('div'); listPanel.className = 'panel';
    const detailPanel = document.createElement('div'); detailPanel.className = 'panel';
    layout.append(listPanel, detailPanel);
    root.appendChild(layout);

    const highlightSelectedRow = () => {
      listPanel.querySelectorAll('tbody tr').forEach((tr) => {
        tr.classList.toggle('active', Number(tr.dataset.id) === Number(state.selectedId));
      });
    };

    const renderList = () => {
      if (!state.planillas.length) {
        listPanel.innerHTML = '<p class="muted">No hay planillas registradas.</p>';
        detailPanel.innerHTML = '<p class="muted">Crea una planilla y luego registra las horas dia por dia.</p>';
        return;
      }
      const rows = state.planillas.map((planilla) => ({
        ...planilla,
        total_crc: toNumber(planilla.total_estimado_crc ?? planilla.total_crc ?? planilla.total ?? 0)
      }));
      listPanel.innerHTML = '';
      const columns = [
        { key: 'id', label: '#' },
        { key: 'semana_inicio', label: 'Semana', format: (value) => fmt.date(value) },
        { key: 'nota', label: 'Nota' },
        { key: 'total_crc', label: 'Total estimado', format: (value) => fmt.money(value || 0) },
        {
          key: 'acciones',
          label: 'Acciones',
          render: (row) => {
            const wrap = document.createElement('div'); wrap.className = 'table-actions';
            const viewBtn = document.createElement('button'); viewBtn.type = 'button'; viewBtn.className = 'btn'; viewBtn.textContent = 'Ver';
            viewBtn.onclick = () => {
              state.selectedId = row.id;
              highlightSelectedRow();
              loadPlanillaDetalle(row.id);
            };
            const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'btn'; editBtn.textContent = 'Editar';
            editBtn.onclick = () => openPlanillaEditModal(row);
            const deleteBtn = document.createElement('button'); deleteBtn.type = 'button'; deleteBtn.className = 'btn'; deleteBtn.textContent = 'Eliminar';
            deleteBtn.onclick = () => deletePlanilla(row);
            wrap.append(viewBtn, editBtn, deleteBtn);
            return wrap;
          }
        }
      ];
      const table = Table({ columns, rows });
      listPanel.appendChild(table);
      table.querySelectorAll('tbody tr').forEach((tr, idx) => {
        const planilla = rows[idx];
        tr.dataset.id = planilla.id;
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (event) => {
          if (event.target.closest('.table-actions')) return;
          state.selectedId = planilla.id;
          highlightSelectedRow();
          loadPlanillaDetalle(planilla.id);
        });
      });
      highlightSelectedRow();
    };    const openPlanillaEditModal = (planilla) => {
      if (!planilla) return;
      const form = document.createElement('form'); form.className = 'form-grid';
      const semanaField = Field('Semana (inicio)', Input({ name: 'semana_inicio', type: 'date', required: true, value: (planilla.semana_inicio || '').slice(0,10) }));
      const notaField = Field('Nota', Input({ name: 'nota', value: planilla.nota || '' }));
      const extraField = Field('Factor extra', Input({ name: 'factor_extra', type: 'number', step: '0.01', value: planilla.factor_extra || FACTOR_EXTRA_DEFAULT }));
      const dobleField = Field('Factor doble', Input({ name: 'factor_doble', type: 'number', step: '0.01', value: planilla.factor_doble || FACTOR_DOBLE_DEFAULT }));
      const feriadoField = Field('Factor feriado', Input({ name: 'factor_feriado', type: 'number', step: '0.01', value: planilla.factor_feriado || FACTOR_FERIADO_DEFAULT }));
      form.append(semanaField, notaField, extraField, dobleField, feriadoField);
      Modal.open({
        title: `Editar planilla #${planilla.id}`,
        okText: 'Guardar',
        content: form,
        onOk: async () => {
          const data = Object.fromEntries(new FormData(form).entries());
          if (!data.semana_inicio) { Toast('Indica la fecha de inicio de semana', 'error'); return false; }
          ['factor_extra','factor_doble','factor_feriado'].forEach((key) => { if (data[key] !== undefined && data[key] !== '') data[key] = Number(data[key]); });
          try {
            await fetchJSON(api(`/planillas/${planilla.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            Toast('Planilla actualizada', 'success');
            await loadPlanillas();
          } catch (err) {
            Toast(err?.message || 'No se pudo actualizar la planilla', 'error');
            return false;
          }
        }
      });
    };

    const deletePlanilla = async (planilla) => {
      if (!planilla) return;
      if (!confirm(`Eliminar planilla #${planilla.id}?`)) return;
      try {
        await fetchJSON(api(`/planillas/${planilla.id}`), { method: 'DELETE' });
        Toast('Planilla eliminada', 'success');
        if (state.selectedId === planilla.id) { state.selectedId = null; detailPanel.innerHTML = '<p class="muted">Selecciona una planilla para ver el detalle.</p>'; }
        await loadPlanillas();
      } catch (err) {
        Toast(err?.message || 'No se pudo eliminar la planilla', 'error');
      }
    };


    const renderDailySummary = () => {
      if (!detailState.dailySummaryEl) return;
      const totals = detailState.rowStates.reduce((acc, row) => {
        const horas = row.getHoras();
        acc.reg += horas.reg;
        acc.extra += horas.extra;
        acc.doble += horas.doble;
        acc.feriado += horas.feriado;
        acc.monto += row.total;
        return acc;
      }, { reg: 0, extra: 0, doble: 0, feriado: 0, monto: 0 });
      detailState.dailySummaryEl.innerHTML = `
        <div><strong>Fecha:</strong> ${fmt.date(state.selectedDate)}</div>
        <div><strong>Horas regulares:</strong> ${formatHours(totals.reg)}</div>
        <div><strong>Horas extra:</strong> ${formatHours(totals.extra)}</div>
        <div><strong>Horas extra doble:</strong> ${formatHours(totals.doble)}</div>
        <div><strong>Horas feriado:</strong> ${formatHours(totals.feriado)}</div>
        <div><strong>Total del dia:</strong> ${fmt.money(totals.monto)}</div>
      `;
    };

    const buildRow = (rowData) => {
      const empleados = Store?.state?.empleados || [];
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      const empleadoSelect = Select({
        name: 'empleado_id',
        items: empleados,
        placeholder: 'Seleccione colaborador',
        valueKey: 'id',
        labelKey: 'nombre',
        required: false
      });
      nameCell.appendChild(empleadoSelect);
      // Quick add empleado button
      const addEmpBtn = document.createElement('button');
      addEmpBtn.type = 'button';
      addEmpBtn.className = 'icon-btn';
      addEmpBtn.title = 'Nuevo empleado';
      addEmpBtn.textContent = '+';
      addEmpBtn.addEventListener('click', () => openQuickEmpleado(() => refreshEmpleadoOptions(empleadoSelect)));
      nameCell.appendChild(addEmpBtn);
      const refreshEmpBtn = document.createElement('button');
      refreshEmpBtn.type = 'button';
      refreshEmpBtn.className = 'icon-btn';
      refreshEmpBtn.title = 'Recargar empleados';
      refreshEmpBtn.textContent = '↻';
      refreshEmpBtn.addEventListener('click', async () => {
        try {
          const empleados = await fetchJSON(api('/contactos/empleados')).catch(()=>[]);
          Store.set({ empleados });
          Toast('Empleados actualizados', 'success');
          refreshEmpleadoOptions(empleadoSelect);
        } catch(e){ Toast(e?.message || 'No se pudieron cargar empleados', 'error'); }
      });
      nameCell.appendChild(refreshEmpBtn);

      // Ensure options are fresh
      refreshEmpleadoOptions(empleadoSelect, rowData?.detalle?.empleado_id || null);
      empleadoSelect.addEventListener('focus', () => refreshEmpleadoOptions(empleadoSelect));
      empleadoSelect.addEventListener('click', () => refreshEmpleadoOptions(empleadoSelect));

      const personaCell = document.createElement('td');
      const personaInput = Input({ name: 'persona', placeholder: 'Nombre manual' });
      if (rowData.detalle?.persona) personaInput.value = rowData.detalle.persona;
      personaCell.appendChild(personaInput);

      const tarifaCell = document.createElement('td');
      const tarifaInput = Input({ name: 'tarifa', type: 'number', step: '0.01', min: '0' });
      tarifaCell.appendChild(tarifaInput);

      const regCell = document.createElement('td');
      const regInput = Input({ name: 'horas_reg', type: 'number', step: '0.01', min: '0' });
      regCell.appendChild(regInput);

      const extraCell = document.createElement('td');
      const extraInput = Input({ name: 'horas_extra', type: 'number', step: '0.01', min: '0' });
      extraCell.appendChild(extraInput);

      const dobleCell = document.createElement('td');
      const dobleInput = Input({ name: 'horas_doble', type: 'number', step: '0.01', min: '0' });
      dobleCell.appendChild(dobleInput);

      const feriadoCell = document.createElement('td');
      const feriadoWrapper = document.createElement('div'); feriadoWrapper.className = 'stack';
      const feriadoInput = Input({ name: 'horas_feriado', type: 'number', step: '0.01', min: '0' });
      feriadoInput.style.maxWidth = '100px';
      const feriadoToggle = document.createElement('label'); feriadoToggle.className = 'checkbox';
      const feriadoCheckbox = document.createElement('input'); feriadoCheckbox.type = 'checkbox';
      feriadoToggle.append(feriadoCheckbox, document.createTextNode('Feriado'));
      feriadoWrapper.append(feriadoInput, feriadoToggle);
      feriadoCell.appendChild(feriadoWrapper);

      const totalCell = document.createElement('td');
      totalCell.className = 'text-right';

      const actionsCell = document.createElement('td');
      actionsCell.className = 'actions';
      const saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'btn-primary'; saveBtn.textContent = 'Guardar';
      const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'btn'; clearBtn.textContent = 'Limpiar';
      const deleteBtn = document.createElement('button'); deleteBtn.type = 'button'; deleteBtn.className = 'btn-outline'; deleteBtn.textContent = rowData.isNew ? 'Cancelar' : 'Eliminar';
      actionsCell.append(saveBtn, clearBtn, deleteBtn);

      tr.append(
        nameCell,
        personaCell,
        tarifaCell,
        regCell,
        extraCell,
        dobleCell,
        feriadoCell,
        totalCell,
        actionsCell
      );

      if (rowData.detalle) {
        if (rowData.detalle.empleado_id) empleadoSelect.value = String(rowData.detalle.empleado_id);
        if (rowData.detalle.tarifa_hora_crc != null) tarifaInput.value = toNumber(rowData.detalle.tarifa_hora_crc).toFixed(2);
      }
      if (rowData.dia) {
        regInput.value = formatHours(rowData.dia.horas_reg);
        extraInput.value = formatHours(rowData.dia.horas_extra);
        dobleInput.value = formatHours(rowData.dia.horas_doble);
        feriadoInput.value = formatHours(rowData.dia.horas_feriado);
        feriadoCheckbox.checked = !!rowData.dia.feriado;
      }
      if (!tarifaInput.value) {
        const emp = empleados.find((e) => Number(e.id) === Number(empleadoSelect.value));
        if (emp?.tarifa_hora_crc != null) tarifaInput.value = toNumber(emp.tarifa_hora_crc).toFixed(2);
      }

      const rowState = {
        key: rowData.key,
        type: rowData.isNew ? 'new' : 'existing',
        detalle: rowData.detalle,
        dia: rowData.dia,
        total: 0,
        elements: {
          empleadoSelect,
          personaInput,
          tarifaInput,
          regInput,
          extraInput,
          dobleInput,
          feriadoInput,
          feriadoCheckbox,
          totalCell,
          saveBtn,
          deleteBtn,
          clearBtn
        },
        getHoras() {
          return {
            reg: toNumber(regInput.value),
            extra: toNumber(extraInput.value),
            doble: toNumber(dobleInput.value),
            feriado: toNumber(feriadoInput.value)
          };
        },
        getTarifa() {
          return toNumber(tarifaInput.value);
        },
        updateTotal() {
          const tarifa = rowState.getTarifa();
          const horas = rowState.getHoras();
          const factors = detailState.factors;
          rowState.total = computeHorasCost(tarifa, horas, factors);
          totalCell.textContent = fmt.money(rowState.total);
          renderDailySummary();
        }
      };

      const syncEmpleadoTarifa = () => {
        const emp = empleados.find((e) => Number(e.id) === Number(empleadoSelect.value));
        if (emp && (!rowData.detalle || toNumber(rowData.detalle.tarifa_hora_crc) === 0 || !tarifaInput.value)) {
          if (emp.tarifa_hora_crc != null) tarifaInput.value = toNumber(emp.tarifa_hora_crc).toFixed(2);
        }
        if (emp && !personaInput.value) personaInput.value = emp.nombre || '';
        rowState.updateTotal();
      };

      empleadoSelect.addEventListener('change', syncEmpleadoTarifa);
      [tarifaInput, regInput, extraInput, dobleInput, feriadoInput].forEach((input) => {
        input.addEventListener('input', rowState.updateTotal);
      });
      feriadoCheckbox.addEventListener('change', () => {
        if (feriadoCheckbox.checked && toNumber(feriadoInput.value) === 0) {
          feriadoInput.value = '8';
        }
        if (!feriadoCheckbox.checked && toNumber(feriadoInput.value) > 0) {
          feriadoInput.value = '0';
        }
        rowState.updateTotal();
      });

      clearBtn.addEventListener('click', () => {
        regInput.value = '0';
        extraInput.value = '0';
        dobleInput.value = '0';
        feriadoInput.value = '0';
        feriadoCheckbox.checked = false;
        rowState.updateTotal();
      });

      saveBtn.addEventListener('click', async () => {
        const empleadoId = Number(empleadoSelect.value || 0) || null;
        const persona = personaInput.value.trim() || null;
        const tarifa = rowState.getTarifa();
        const horas = rowState.getHoras();
        const feriadoFlag = feriadoCheckbox.checked || horas.feriado > 0;
        if (!empleadoId && !persona) {
          Toast('Selecciona un empleado o indica un nombre manual', 'error');
          return;
        }
        if (!tarifa) {
          Toast('Indica la tarifa base del colaborador', 'error');
          return;
        }
        saveBtn.disabled = true;
        // Auto-crear planilla por semana si no existe
        if (!state.selectedId) {
          try {
            const semana = getWeekStartDate(state.selectedDate);
            const created = await fetchJSON(api('/planillas'), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ semana_inicio: semana, nota: null })
            });
            state.selectedId = created.id;
            await loadPlanillas();
          } catch (e) {
            console.error(e);
            Toast(e?.message || 'No se pudo crear la planilla para la fecha seleccionada','error');
            saveBtn.disabled = false; saveBtn.textContent = 'Guardar';
            return;
          }
        }
        saveBtn.textContent = 'Guardando...';
        try {
          let detalleId = rowState.detalle?.id;
          if (!detalleId) {
            const body = {
              empleado_id: empleadoId,
              persona,
              tarifa_hora_crc: tarifa
            };
            const nuevo = await fetchJSON(api(`/planillas/${state.selectedId}/detalles`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            detalleId = nuevo?.id;
          } else {
            const updates = {};
            if (rowState.detalle?.empleado_id !== empleadoId) updates.empleado_id = empleadoId;
            if ((rowState.detalle?.persona || '') !== (persona || null)) updates.persona = persona;
            if (toNumber(rowState.detalle?.tarifa_hora_crc) !== tarifa) updates.tarifa_hora_crc = tarifa;
            if (Object.keys(updates).length) {
              await fetchJSON(api(`/planillas/${state.selectedId}/detalles/${detalleId}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
              });
            }
          }
          if (!detalleId) throw new Error('No se pudo identificar el colaborador');
          const allZero = !horas.reg && !horas.extra && !horas.doble && !horas.feriado && !feriadoFlag;
          if (allZero) {
            await fetchJSON(api(`/planillas/${state.selectedId}/detalles/${detalleId}/dias/${state.selectedDate}`), {
              method: 'DELETE'
            }).catch(() => null);
          } else {
            const payload = {
              dias: [{
                fecha: state.selectedDate,
                horas_reg: horas.reg,
                horas_extra: horas.extra,
                horas_doble: horas.doble,
                feriado: feriadoFlag,
                horas_feriado: horas.feriado
              }]
            };
            await fetchJSON(api(`/planillas/${state.selectedId}/detalles/${detalleId}/dias`), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }
          Toast('Registro guardado', 'success');
          detailState.newRows = detailState.newRows.filter((item) => item.key !== rowState.key);
          await loadPlanillaDetalle(state.selectedId);
        } catch (error) {
          console.error(error);
          Toast(error?.message || 'No se pudo guardar el registro', 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar';
        }
      });

      deleteBtn.addEventListener('click', async () => {
        if (rowState.type === 'new') {
          detailState.newRows = detailState.newRows.filter((item) => item.key !== rowState.key);
          renderDailyRows();
          return;
        }
        const detalleId = rowState.detalle?.id;
        if (!detalleId) return;
        const horas = rowState.getHoras();
        const hasDia = rowState.dia || horas.reg || horas.extra || horas.doble || horas.feriado || rowState.total > 0;
        try {
          if (hasDia) {
            const confirmed = confirm('Eliminar el registro de este dia para el colaborador?');
            if (!confirmed) return;
            await fetchJSON(api(`/planillas/${state.selectedId}/detalles/${detalleId}/dias/${state.selectedDate}`), {
              method: 'DELETE'
            });
            Toast('Registro diario eliminado', 'success');
          } else {
            const confirmed = confirm('Eliminar por completo al colaborador de la planilla?');
            if (!confirmed) return;
            await fetchJSON(api(`/planillas/${state.selectedId}/detalles/${detalleId}`), {
              method: 'DELETE'
            });
            Toast('Colaborador eliminado', 'success');
          }
          await loadPlanillaDetalle(state.selectedId);
        } catch (error) {
          console.error(error);
          Toast(error?.message || 'No se pudo eliminar el registro', 'error');
        }
      });

      rowState.updateTotal();
      detailState.rowStates.push(rowState);
      return tr;
    };

    const renderDailyRows = () => {
      if (!detailState.tbody) return;
      detailState.rowStates = [];
      const tbody = detailState.tbody;
      tbody.innerHTML = '';
      detailState.weekTabButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.date === state.selectedDate);
      });
      if (detailState.dateInput) detailState.dateInput.value = state.selectedDate;

      const rows = (detailState.data?.detalles || [])
        .map((detalle) => {
          const dia = (detalle.dias || []).find((d) => safeDate(d.fecha) === state.selectedDate);
          return {
            key: `det-${detalle.id}`,
            detalle,
            dia
          };
        })
        .sort((a, b) => labelForDetalle(a.detalle).localeCompare(labelForDetalle(b.detalle)));

      const completeRows = [...rows, ...detailState.newRows];

      if (!completeRows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 9;
        td.className = 'muted';
        td.textContent = 'Agrega colaboradores y captura las horas del dia.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        renderDailySummary();
        return;
      }

      completeRows.forEach((row) => {
        const tr = buildRow(row);
        tbody.appendChild(tr);
      });

      detailState.rowStates.forEach((row) => row.updateTotal());
      renderDailySummary();
    };

    const renderDetalle = (data) => {
      detailState.data = data;
      detailPanel.innerHTML = '';
      detailState.newRows = [];
      if (!data) {
        detailPanel.innerHTML = '<p class="muted">Selecciona una planilla para ver el detalle.</p>';
        return;
      }

      detailState.factors = {
        extra: toNumber(data.factor_extra) || FACTOR_EXTRA_DEFAULT,
        doble: toNumber(data.factor_doble) || FACTOR_DOBLE_DEFAULT,
        feriado: toNumber(data.factor_feriado) || FACTOR_FERIADO_DEFAULT
      };
      detailState.weekDates = getWeekDates(data);
      state.selectedDate = clampDateToWeek(data, state.selectedDate);

      const header = document.createElement('div');
      header.className = 'planilla-header';
      header.innerHTML = `
        <h3>Planilla #${data.id}</h3>
        <p><strong>Semana:</strong> ${fmt.date(data.semana_inicio)}${data.nota ? ` - ${data.nota}` : ''}</p>
      `;
      detailPanel.appendChild(header);

      const kpi = document.createElement('div');
      kpi.className = 'kpi-grid';
      const totales = data.totales || { horas_reg: 0, horas_extra: 0, horas_doble: 0, horas_feriado: 0, colaboradores: 0, monto_crc: 0 };
      kpi.innerHTML = `
        <div class="card kpi"><h3>Colaboradores</h3><div class="big">${totales.colaboradores || 0}</div></div>
        <div class="card kpi"><h3>Horas totales</h3><div class="big">${formatHours((totales.horas_reg || 0) + (totales.horas_extra || 0) + (totales.horas_doble || 0) + (totales.horas_feriado || 0))}</div></div>
        <div class="card kpi"><h3>Horas regulares</h3><div class="big">${formatHours(totales.horas_reg || 0)}</div></div>
        <div class="card kpi"><h3>Estimado semanal</h3><div class="big">${fmt.money(totales.monto_crc || 0)}</div></div>
      `;
      detailPanel.appendChild(kpi);

      const factorCard = document.createElement('div');
      factorCard.className = 'subpanel';
      factorCard.innerHTML = '<h4>Factores de calculo</h4>';
      const factorForm = document.createElement('form');
      factorForm.className = 'form-grid';
      const extraField = Field('Extra', Input({ name: 'factor_extra', type: 'number', step: '0.01', value: detailState.factors.extra.toFixed(2) }));
      const dobleField = Field('Dobles', Input({ name: 'factor_doble', type: 'number', step: '0.01', value: detailState.factors.doble.toFixed(2) }));
      const feriadoField = Field('Feriado', Input({ name: 'factor_feriado', type: 'number', step: '0.01', value: detailState.factors.feriado.toFixed(2) }));
      const actionsWrap = document.createElement('div'); actionsWrap.className = 'form-actions';
      const saveFactorsBtn = document.createElement('button'); saveFactorsBtn.type = 'submit'; saveFactorsBtn.className = 'btn'; saveFactorsBtn.textContent = 'Actualizar factores';
      actionsWrap.appendChild(saveFactorsBtn);
      factorForm.append(extraField, dobleField, feriadoField, actionsWrap);
      factorCard.appendChild(factorForm);
      detailPanel.appendChild(factorCard);

      const syncFactorAndTotals = () => {
        detailState.factors = {
          extra: toNumber(extraField.querySelector('input').value) || FACTOR_EXTRA_DEFAULT,
          doble: toNumber(dobleField.querySelector('input').value) || FACTOR_DOBLE_DEFAULT,
          feriado: toNumber(feriadoField.querySelector('input').value) || FACTOR_FERIADO_DEFAULT
        };
        detailState.rowStates.forEach((row) => row.updateTotal());
      };
      ['input', 'change'].forEach((evt) => {
        extraField.querySelector('input').addEventListener(evt, syncFactorAndTotals);
        dobleField.querySelector('input').addEventListener(evt, syncFactorAndTotals);
        feriadoField.querySelector('input').addEventListener(evt, syncFactorAndTotals);
      });

      factorForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        saveFactorsBtn.disabled = true;
        saveFactorsBtn.textContent = 'Guardando...';
        try {
          const payload = {
            factor_extra: detailState.factors.extra,
            factor_doble: detailState.factors.doble,
            factor_feriado: detailState.factors.feriado
          };
          await fetchJSON(api(`/planillas/${data.id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          Toast('Factores actualizados', 'success');
          await loadPlanillaDetalle(data.id);
        } catch (error) {
          console.error(error);
          Toast(error?.message || 'No se pudieron actualizar los factores', 'error');
        } finally {
          saveFactorsBtn.disabled = false;
          saveFactorsBtn.textContent = 'Actualizar factores';
        }
      });

      const dayCard = document.createElement('div');
      dayCard.className = 'subpanel';
      dayCard.innerHTML = '<h4>Registro diario</h4>';
      const controls = document.createElement('div'); controls.className = 'day-controls';

      const tabs = document.createElement('div'); tabs.className = 'tabs';
      detailState.weekTabButtons = detailState.weekDates.map((dateStr) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = fmt.date(dateStr);
        btn.dataset.date = dateStr;
        btn.classList.toggle('active', dateStr === state.selectedDate);
        btn.addEventListener('click', () => {
          state.selectedDate = dateStr;
          detailState.newRows = [];
          renderDailyRows();
        });
        tabs.appendChild(btn);
        return btn;
      });

      const dateField = Field('Fecha', Input({ name: 'fecha', type: 'date', value: state.selectedDate }));
      detailState.dateInput = dateField.querySelector('input');
      detailState.dateInput.addEventListener('change', () => {
        const value = safeDate(detailState.dateInput.value);
        if (!value) {
          detailState.dateInput.value = state.selectedDate;
          return;
        }
        state.selectedDate = value;
        detailState.newRows = [];
        renderDailyRows();
      });

      const addRowBtn = document.createElement('button');
      addRowBtn.type = 'button';
      addRowBtn.className = 'btn';
      addRowBtn.textContent = 'Agregar fila';
      addRowBtn.addEventListener('click', () => {
        detailState.newRows.push({
          key: `new-${Date.now()}`,
          isNew: true,
          detalle: null,
          dia: null
        });
        renderDailyRows();
      });

      controls.append(tabs, dateField, addRowBtn);
      dayCard.appendChild(controls);
      const logicHint = document.createElement('small');
      logicHint.className = 'muted';
      logicHint.style.display = 'block';
      logicHint.style.margin = '8px 0';
      logicHint.textContent = 'Selecciona una fecha y registra las horas del dia; la planilla semanal se crea automaticamente segun la semana de la fecha.';
      dayCard.appendChild(logicHint);
      detailPanel.appendChild(dayCard);
      if ((Store?.state?.empleados || []).length === 0) {
        const hint = document.createElement('div');
        hint.className = 'muted';
        hint.style.marginBottom = '8px';
        hint.textContent = 'No hay empleados registrados. Crea uno para poder seleccionarlo.';
        const addBtn = document.createElement('button');
        addBtn.type = 'button'; addBtn.className = 'btn'; addBtn.textContent = 'Nuevo empleado'; addBtn.style.marginLeft = '8px';
        addBtn.addEventListener('click', () => openQuickEmpleado(async () => { try { const empleados = await fetchJSON(api('/contactos/empleados')).catch(()=>[]); Store.set({ empleados }); renderDailyRows(); } catch {} }));
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.alignItems = 'center';
        wrap.append(hint, addBtn);
        detailPanel.appendChild(wrap);
      }

      const tableWrap = document.createElement('div'); tableWrap.className = 'table-wrap';
      const table = document.createElement('table'); table.className = 'table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Nombre manual</th>
            <th>Tarifa base</th>
            <th>Horas regulares</th>
            <th>Horas extra (1.5x)</th>
            <th>Horas extra doble (2.0x)</th>
            <th>Feriado</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      detailPanel.appendChild(tableWrap);
      detailState.tbody = tbody;

      const dailySummary = document.createElement('div');
      dailySummary.className = 'daily-summary';
      detailPanel.appendChild(dailySummary);
      detailState.dailySummaryEl = dailySummary;

      renderDailyRows();
    };

    const loadPlanillaDetalle = async (id) => {
      if (!id) {
        renderDetalle(null);
        return;
      }
      detailPanel.innerHTML = '<p class="muted">Cargando planilla...</p>';
      try {
        const data = await fetchJSON(api(`/planillas/${id}`));
        renderDetalle(data);
      } catch (error) {
        console.error(error);
        detailPanel.innerHTML = '<p class="muted">No se pudo cargar la planilla seleccionada.</p>';
        Toast('No se pudo cargar la planilla', 'error');
      }
    };

    const loadPlanillas = async () => {
      listPanel.innerHTML = '<p class="muted">Cargando planillas...</p>';
      try {
        const qs = state.filterMonth ? `?mes=${encodeURIComponent(state.filterMonth)}` : '';
        const data = await fetchJSON(api(`/planillas${qs}`));
        state.planillas = Array.isArray(data) ? data : [];
        if (!state.planillas.length) {
          renderList();
          renderDetalle(null);
          state.selectedId = null;
          return;
        }
        if (!state.selectedId || !state.planillas.some((p) => Number(p.id) === Number(state.selectedId))) {
          state.selectedId = state.planillas[0].id;
        }
        renderList();
        await loadPlanillaDetalle(state.selectedId);
      } catch (error) {
        console.error(error);
        listPanel.innerHTML = '<p class="muted">No se pudieron cargar las planillas.</p>';
        renderDetalle(null);
        Toast('No se pudieron cargar las planillas', 'error');
      }
    };

    topPanel.querySelector('[data-action="crear"]').addEventListener('click', async () => {
      const semana = semanaInput?.value;
      const nota = topPanel.querySelector('input[name="nota"]').value.trim() || null;
      const factorExtra = toNumber(topPanel.querySelector('input[name="factor_extra"]').value) || FACTOR_EXTRA_DEFAULT;
      const factorDoble = toNumber(topPanel.querySelector('input[name="factor_doble"]').value) || FACTOR_DOBLE_DEFAULT;
      const factorFeriado = toNumber(topPanel.querySelector('input[name="factor_feriado"]').value) || FACTOR_FERIADO_DEFAULT;
      if (!semana) {
        Toast('Indica la fecha de inicio de semana', 'error');
        return;
      }
      try {
        const body = {
          semana_inicio: semana,
          nota,
          factor_extra: factorExtra,
          factor_doble: factorDoble,
          factor_feriado: factorFeriado
        };
        const res = await fetchJSON(api('/planillas'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        Toast(`Planilla #${res.id} creada`, 'success');
        state.selectedId = res.id;
        await loadPlanillas();
      } catch (error) {
        console.error(error);
        Toast(error?.message || 'No se pudo crear la planilla', 'error');
      }
    });

    topPanel.querySelector('[data-action="filtrar"]').addEventListener('click', () => {
      state.filterMonth = topPanel.querySelector('input[name="f_mes"]').value || '';
      loadPlanillas();
    });

    topPanel.querySelector('[data-action="limpiar"]').addEventListener('click', () => {
      topPanel.querySelector('input[name="f_mes"]').value = '';
      state.filterMonth = '';
      loadPlanillas();
    });

    loadPlanillas();
  };

  window.renderPlanillas = renderPlanillas;
  window.dispatchEvent(new Event('planillas-ready'));
})();










