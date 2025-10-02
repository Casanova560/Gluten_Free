from datetime import date
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from ..utils.deps import db_dep

FACTOR_EXTRA_DEFAULT = 1.5
FACTOR_DOBLE_DEFAULT = 2.0
FACTOR_FERIADO_DEFAULT = 2.0

router = APIRouter(prefix="/planillas", tags=["planillas"])


def _normalize_factor(value, fallback):
    try:
        if value is None or value == "":
            return fallback
        number = float(value)
        if number <= 0:
            return fallback
        return number
    except (TypeError, ValueError):
        return fallback


def _coerce_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _calc_total(tarifa, horas_reg, horas_extra, horas_doble, horas_feriado, factor_extra, factor_doble, factor_feriado):
    tarifa = float(tarifa or 0)
    reg = float(horas_reg or 0)
    extra = float(horas_extra or 0)
    doble = float(horas_doble or 0)
    feriado = float(horas_feriado or 0)
    return (
        tarifa * reg
        + tarifa * factor_extra * extra
        + tarifa * factor_doble * doble
        + tarifa * factor_feriado * feriado
    )


@router.get("")
def listar(mes: str | None = None, db = Depends(db_dep)):
    params = {
        "fx": FACTOR_EXTRA_DEFAULT,
        "fd": FACTOR_DOBLE_DEFAULT,
        "ff": FACTOR_FERIADO_DEFAULT,
    }
    where = ""
    if mes:
        where = " WHERE DATE_FORMAT(ps.semana_inicio,'%Y-%m') = :mes"
        params["mes"] = mes
    query = f"""
        SELECT
            ps.id,
            ps.semana_inicio,
            ps.nota,
            COALESCE(ps.factor_extra, :fx) AS factor_extra,
            COALESCE(ps.factor_doble, :fd) AS factor_doble,
            COALESCE(ps.factor_feriado, :ff) AS factor_feriado,
            COALESCE(SUM(COALESCE(dd.horas_reg, 0)), 0) AS horas_reg,
            COALESCE(SUM(COALESCE(dd.horas_extra, 0)), 0) AS horas_extra,
            COALESCE(SUM(COALESCE(dd.horas_doble, 0)), 0) AS horas_doble,
            COALESCE(SUM(COALESCE(dd.horas_feriado, 0)), 0) AS horas_feriado,
            COUNT(DISTINCT d.id) AS colaboradores,
            COALESCE(SUM(
                COALESCE(d.tarifa_hora_crc, 0) * COALESCE(dd.horas_reg, 0)
                + COALESCE(d.tarifa_hora_crc, 0) * COALESCE(ps.factor_extra, :fx) * COALESCE(dd.horas_extra, 0)
                + COALESCE(d.tarifa_hora_crc, 0) * COALESCE(ps.factor_doble, :fd) * COALESCE(dd.horas_doble, 0)
                + COALESCE(d.tarifa_hora_crc, 0) * COALESCE(ps.factor_feriado, :ff) * COALESCE(dd.horas_feriado, 0)
            ), 0) AS total_estimado_crc
        FROM planilla_semana ps
        LEFT JOIN planilla_det d ON d.planilla_id = ps.id
        LEFT JOIN planilla_det_dia dd ON dd.det_id = d.id
        {where}
        GROUP BY ps.id
        ORDER BY ps.semana_inicio DESC
    """
    return db.execute(text(query), params).mappings().all()


@router.post("")
def crear(payload: dict, db = Depends(db_dep)):
    semana_inicio = payload.get("semana_inicio")
    if not semana_inicio:
        raise HTTPException(400, "semana_inicio requerido (YYYY-MM-DD)")
    nota = payload.get("nota")
    factor_extra = _normalize_factor(payload.get("factor_extra"), FACTOR_EXTRA_DEFAULT)
    factor_doble = _normalize_factor(payload.get("factor_doble"), FACTOR_DOBLE_DEFAULT)
    factor_feriado = _normalize_factor(payload.get("factor_feriado"), FACTOR_FERIADO_DEFAULT)
    res = db.execute(text("""
        INSERT INTO planilla_semana (semana_inicio, nota, factor_extra, factor_doble, factor_feriado)
        VALUES (:semana_inicio, :nota, :factor_extra, :factor_doble, :factor_feriado)
    """), {
        "semana_inicio": semana_inicio,
        "nota": nota,
        "factor_extra": factor_extra,
        "factor_doble": factor_doble,
        "factor_feriado": factor_feriado,
    })
    db.commit()
    return {"id": res.lastrowid}


@router.put("/{planilla_id}")
def actualizar(planilla_id: int, payload: dict, db = Depends(db_dep)):
    exists = db.execute(text("SELECT id FROM planilla_semana WHERE id=:id"), {"id": planilla_id}).first()
    if not exists:
        raise HTTPException(404, "Planilla no encontrada")
    data = {
        "id": planilla_id,
        "semana_inicio": payload.get("semana_inicio"),
        "nota": payload.get("nota"),
        "factor_extra": _normalize_factor(payload.get("factor_extra"), None),
        "factor_doble": _normalize_factor(payload.get("factor_doble"), None),
        "factor_feriado": _normalize_factor(payload.get("factor_feriado"), None),
    }
    db.execute(text("""
        UPDATE planilla_semana
        SET
          semana_inicio = COALESCE(:semana_inicio, semana_inicio),
          nota = COALESCE(:nota, nota),
          factor_extra = COALESCE(:factor_extra, factor_extra),
          factor_doble = COALESCE(:factor_doble, factor_doble),
          factor_feriado = COALESCE(:factor_feriado, factor_feriado)
        WHERE id = :id
    """), data)
    db.commit()
    return {"ok": True}


@router.delete("/{planilla_id}")
def eliminar(planilla_id: int, db = Depends(db_dep)):
    res = db.execute(text("DELETE FROM planilla_semana WHERE id=:id"), {"id": planilla_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Planilla no encontrada")
    return {"ok": True}


@router.get("/{planilla_id}")
def detalle(planilla_id: int, db = Depends(db_dep)):
    planilla = db.execute(text("""
        SELECT id, semana_inicio, nota,
               COALESCE(factor_extra, :fx) AS factor_extra,
               COALESCE(factor_doble, :fd) AS factor_doble,
               COALESCE(factor_feriado, :ff) AS factor_feriado
        FROM planilla_semana WHERE id = :id
    """), {
        "id": planilla_id,
        "fx": FACTOR_EXTRA_DEFAULT,
        "fd": FACTOR_DOBLE_DEFAULT,
        "ff": FACTOR_FERIADO_DEFAULT,
    }).mappings().first()
    if not planilla:
        raise HTTPException(404, "Planilla no encontrada")

    detalles = db.execute(text("""
        SELECT d.id, d.planilla_id, d.empleado_id, e.nombre AS empleado_nombre,
               d.persona, d.rol, d.tarifa_hora_crc,
               d.horas_previstas, d.horas_efectivas, d.estado_pago
        FROM planilla_det d
        LEFT JOIN empleado e ON e.id = d.empleado_id
        WHERE d.planilla_id = :id
        ORDER BY COALESCE(e.nombre, d.persona, '')
    """), {"id": planilla_id}).mappings().all()

    det_ids = [row["id"] for row in detalles]
    dias_map: Dict[int, List[dict]] = {}
    if det_ids:
        params = {f"id{i}": ident for i, ident in enumerate(det_ids)}
        placeholders = ", ".join(f":id{i}" for i in range(len(det_ids)))
        dias_rows = db.execute(text(f"""
            SELECT det_id, fecha, horas_reg, horas_extra, horas_doble, feriado, horas_feriado
            FROM planilla_det_dia
            WHERE det_id IN ({placeholders})
            ORDER BY fecha
        """), params).mappings().all()
        for row in dias_rows:
            dias_map.setdefault(row["det_id"], []).append({
                "fecha": row["fecha"],
                "horas_reg": float(row["horas_reg"] or 0),
                "horas_extra": float(row["horas_extra"] or 0),
                "horas_doble": float(row["horas_doble"] or 0),
                "horas_feriado": float(row["horas_feriado"] or 0),
                "feriado": bool(row["feriado"]),
            })

    factor_extra = float(planilla["factor_extra"] or FACTOR_EXTRA_DEFAULT)
    factor_doble = float(planilla["factor_doble"] or FACTOR_DOBLE_DEFAULT)
    factor_feriado = float(planilla["factor_feriado"] or FACTOR_FERIADO_DEFAULT)

    totales = {
        "horas_reg": 0.0,
        "horas_extra": 0.0,
        "horas_doble": 0.0,
        "horas_feriado": 0.0,
        "monto_crc": 0.0,
        "colaboradores": len(detalles),
    }

    detalles_out = []
    for det in detalles:
        dias = dias_map.get(det["id"], [])
        resumen = {
            "reg": sum(dia["horas_reg"] for dia in dias),
            "extra": sum(dia["horas_extra"] for dia in dias),
            "dob": sum(dia["horas_doble"] for dia in dias),
            "feriado": sum(dia["horas_feriado"] for dia in dias),
        }
        total_det = 0.0
        dias_out = []
        for dia in dias:
            total_dia = _calc_total(
                det["tarifa_hora_crc"],
                dia["horas_reg"],
                dia["horas_extra"],
                dia["horas_doble"],
                dia["horas_feriado"],
                factor_extra,
                factor_doble,
                factor_feriado,
            )
            total_det += total_dia
            dias_out.append({**dia, "total_crc": total_dia})

        totales["horas_reg"] += resumen["reg"]
        totales["horas_extra"] += resumen["extra"]
        totales["horas_doble"] += resumen["dob"]
        totales["horas_feriado"] += resumen["feriado"]
        totales["monto_crc"] += total_det

        detalles_out.append({
            "id": det["id"],
            "planilla_id": det["planilla_id"],
            "empleado_id": det["empleado_id"],
            "empleado_nombre": det["empleado_nombre"],
            "persona": det["persona"],
            "rol": det["rol"],
            "tarifa_hora_crc": float(det["tarifa_hora_crc"] or 0),
            "horas_previstas": float(det["horas_previstas"] or 0),
            "horas_efectivas": float(det["horas_efectivas"] or 0),
            "estado_pago": det["estado_pago"],
            "resumen": resumen,
            "dias": dias_out,
            "total_estimado_crc": total_det,
        })

    planilla_out = {
        "id": planilla["id"],
        "semana_inicio": planilla["semana_inicio"],
        "nota": planilla.get("nota"),
        "factor_extra": factor_extra,
        "factor_doble": factor_doble,
        "factor_feriado": factor_feriado,
        "detalles": detalles_out,
        "totales": totales,
    }
    return planilla_out


@router.post("/{planilla_id}/detalles")
def add_det(planilla_id: int, payload: dict, db = Depends(db_dep)):
    exists = db.execute(text("SELECT id FROM planilla_semana WHERE id=:id"), {"id": planilla_id}).first()
    if not exists:
        raise HTTPException(404, "Planilla no encontrada")
    empleado_id = payload.get("empleado_id")
    persona = (payload.get("persona") or "").strip() or None
    if not empleado_id and not persona:
        raise HTTPException(400, "empleado_id o persona requerido")
    data = {
        "planilla_id": planilla_id,
        "empleado_id": empleado_id,
        "persona": persona,
        "rol": payload.get("rol"),
        "tarifa_hora_crc": float(payload.get("tarifa_hora_crc") or 0),
        "horas_previstas": float(payload.get("horas_previstas") or 0),
        "horas_efectivas": float(payload.get("horas_efectivas") or 0),
        "estado_pago": payload.get("estado_pago") or "PENDIENTE",
    }
    res = db.execute(text("""
        INSERT INTO planilla_det (planilla_id, empleado_id, persona, rol, tarifa_hora_crc, horas_previstas, horas_efectivas, estado_pago)
        VALUES (:planilla_id, :empleado_id, :persona, :rol, :tarifa_hora_crc, :horas_previstas, :horas_efectivas, :estado_pago)
    """), data)
    db.commit()
    new_id = res.lastrowid
    detalle = db.execute(text("""
        SELECT d.id, d.planilla_id, d.empleado_id, e.nombre AS empleado_nombre,
               d.persona, d.rol, d.tarifa_hora_crc, d.horas_previstas, d.horas_efectivas, d.estado_pago
        FROM planilla_det d
        LEFT JOIN empleado e ON e.id = d.empleado_id
        WHERE d.id = :id
    """), {"id": new_id}).mappings().first()
    return detalle


@router.put("/{planilla_id}/detalles/{det_id}")
def update_det(planilla_id: int, det_id: int, payload: dict, db = Depends(db_dep)):
    detalle = db.execute(text("SELECT id FROM planilla_det WHERE id=:id AND planilla_id=:pid"), {"id": det_id, "pid": planilla_id}).first()
    if not detalle:
        raise HTTPException(404, "Detalle no encontrado")
    data = {
        "id": det_id,
        "planilla_id": planilla_id,
        "empleado_id": payload.get("empleado_id"),
        "persona": (payload.get("persona") or "").strip() or None,
        "rol": payload.get("rol"),
        "tarifa_hora_crc": payload.get("tarifa_hora_crc"),
        "horas_previstas": payload.get("horas_previstas"),
        "horas_efectivas": payload.get("horas_efectivas"),
        "estado_pago": payload.get("estado_pago"),
    }
    db.execute(text("""
        UPDATE planilla_det SET
          empleado_id = COALESCE(:empleado_id, empleado_id),
          persona = COALESCE(:persona, persona),
          rol = COALESCE(:rol, rol),
          tarifa_hora_crc = COALESCE(:tarifa_hora_crc, tarifa_hora_crc),
          horas_previstas = COALESCE(:horas_previstas, horas_previstas),
          horas_efectivas = COALESCE(:horas_efectivas, horas_efectivas),
          estado_pago = COALESCE(:estado_pago, estado_pago)
        WHERE id = :id AND planilla_id = :planilla_id
    """), data)
    db.commit()
    return {"ok": True}


@router.delete("/{planilla_id}/detalles/{det_id}")
def delete_det(planilla_id: int, det_id: int, db = Depends(db_dep)):
    res = db.execute(text("DELETE FROM planilla_det WHERE id=:id AND planilla_id=:pid"), {"id": det_id, "pid": planilla_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Detalle no encontrado")
    return {"ok": True}


@router.put("/{planilla_id}/detalles/{det_id}/dias")
def put_dias(planilla_id: int, det_id: int, payload: dict, db = Depends(db_dep)):
    detalle = db.execute(text("SELECT id FROM planilla_det WHERE id=:id AND planilla_id=:pid"), {"id": det_id, "pid": planilla_id}).first()
    if not detalle:
        raise HTTPException(404, "Detalle no encontrado")
    dias = payload.get("dias") or []
    afectados = 0
    for d in dias:
        fecha = _coerce_date(d.get("fecha"))
        if not fecha:
            raise HTTPException(400, "fecha invalida (YYYY-MM-DD)")
        body = {
            "det_id": det_id,
            "fecha": fecha.isoformat(),
            "horas_reg": float(d.get("horas_reg") or 0),
            "horas_extra": float(d.get("horas_extra") or 0),
            "horas_doble": float(d.get("horas_doble") or 0),
            "feriado": 1 if d.get("feriado") else 0,
            "horas_feriado": float(d.get("horas_feriado") or 0),
        }
        if body["horas_reg"] == 0 and body["horas_extra"] == 0 and body["horas_doble"] == 0 and body["horas_feriado"] == 0 and body["feriado"] == 0:
            db.execute(text("DELETE FROM planilla_det_dia WHERE det_id=:det_id AND fecha=:fecha"), body)
            continue
        db.execute(text("""
            INSERT INTO planilla_det_dia (det_id, fecha, horas_reg, horas_extra, horas_doble, feriado, horas_feriado)
            VALUES (:det_id, :fecha, :horas_reg, :horas_extra, :horas_doble, :feriado, :horas_feriado)
            ON DUPLICATE KEY UPDATE
              horas_reg=VALUES(horas_reg),
              horas_extra=VALUES(horas_extra),
              horas_doble=VALUES(horas_doble),
              feriado=VALUES(feriado),
              horas_feriado=VALUES(horas_feriado)
        """), body)
        afectados += 1
    db.commit()
    return {"ok": True, "n": afectados}


@router.delete("/{planilla_id}/detalles/{det_id}/dias/{fecha}")
def delete_dia(planilla_id: int, det_id: int, fecha: str, db = Depends(db_dep)):
    detalle = db.execute(text("SELECT id FROM planilla_det WHERE id=:id AND planilla_id=:pid"), {"id": det_id, "pid": planilla_id}).first()
    if not detalle:
        raise HTTPException(404, "Detalle no encontrado")
    fecha_norm = _coerce_date(fecha)
    if not fecha_norm:
        raise HTTPException(400, "fecha invalida (YYYY-MM-DD)")
    res = db.execute(text("DELETE FROM planilla_det_dia WHERE det_id=:det_id AND fecha=:fecha"), {
        "det_id": det_id,
        "fecha": fecha_norm.isoformat(),
    })
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Registro de dia no encontrado")
    return {"ok": True}


@router.get("/{planilla_id}/pagos")
def get_pagos(planilla_id: int, db = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id, planilla_id, fecha, empleado_id,
               (SELECT nombre FROM empleado WHERE id = empleado_id) AS empleado_nombre,
               monto_crc, metodo, nota
        FROM planilla_pago WHERE planilla_id = :id ORDER BY fecha DESC, id DESC
    """), {"id": planilla_id}).mappings().all()
    return rows


@router.post("/{planilla_id}/pagos")
def add_pago(planilla_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "planilla_id": planilla_id,
        "fecha": payload.get("fecha"),
        "empleado_id": payload.get("empleado_id"),
        "monto_crc": float(payload.get("monto_crc") or 0),
        "metodo": payload.get("metodo"),
        "nota": payload.get("nota"),
    }
    if not data["fecha"]:
        raise HTTPException(400, "fecha requerida")
    db.execute(text("""
        INSERT INTO planilla_pago (planilla_id, fecha, empleado_id, monto_crc, metodo, nota)
        VALUES (:planilla_id, :fecha, :empleado_id, :monto_crc, :metodo, :nota)
    """), data)
    db.commit()
    return {"ok": True}


@router.put("/{planilla_id}/pagos/{pago_id}")
def update_pago(planilla_id: int, pago_id: int, payload: dict, db = Depends(db_dep)):
    exists = db.execute(text("SELECT id FROM planilla_pago WHERE id=:id AND planilla_id=:pid"), {"id": pago_id, "pid": planilla_id}).first()
    if not exists:
        raise HTTPException(404, "Pago no encontrado")
    data = {
        "id": pago_id,
        "planilla_id": planilla_id,
        "fecha": payload.get("fecha"),
        "empleado_id": payload.get("empleado_id"),
        "monto_crc": payload.get("monto_crc"),
        "metodo": payload.get("metodo"),
        "nota": payload.get("nota"),
    }
    db.execute(text("""
        UPDATE planilla_pago SET
          fecha = COALESCE(:fecha, fecha),
          empleado_id = COALESCE(:empleado_id, empleado_id),
          monto_crc = COALESCE(:monto_crc, monto_crc),
          metodo = COALESCE(:metodo, metodo),
          nota = COALESCE(:nota, nota)
        WHERE id = :id AND planilla_id = :planilla_id
    """), data)
    db.commit()
    return {"ok": True}


@router.delete("/{planilla_id}/pagos/{pago_id}")
def delete_pago(planilla_id: int, pago_id: int, db = Depends(db_dep)):
    res = db.execute(text("DELETE FROM planilla_pago WHERE id=:id AND planilla_id=:pid"), {"id": pago_id, "pid": planilla_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Pago no encontrado")
    return {"ok": True}
