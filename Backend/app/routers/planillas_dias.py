from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from ..utils.deps import db_dep

router = APIRouter(prefix="/planillas", tags=["planillas-dia"])


def calc_total(tarifa: float, horas: float, he: float, hd: float) -> float:
    t = float(tarifa or 0)
    return t * float(horas or 0) + t * 1.5 * float(he or 0) + t * 1.5 * 2 * float(hd or 0)


@router.post("/dias")
def crear_dia(payload: dict, db = Depends(db_dep)) -> Any:
    fecha = payload.get("fecha")
    if not fecha:
        raise HTTPException(400, "fecha requerida (YYYY-MM-DD)")
    nota = payload.get("nota")
    res = db.execute(text("INSERT INTO planilla_dias (fecha, nota) VALUES (:f, :n)"), {"f": fecha, "n": nota})
    db.commit()
    return {"id": res.lastrowid, "fecha": fecha, "nota": nota}


@router.get("/dias")
def listar_dias(db = Depends(db_dep)) -> List[dict]:
    q = text(
        """
        SELECT d.id, d.fecha, d.nota,
               COALESCE(SUM(l.total_crc),0) AS total_crc,
               COUNT(l.id) AS lineas
        FROM planilla_dias d
        LEFT JOIN planilla_lineas l ON l.planilla_dia_id = d.id
        GROUP BY d.id
        ORDER BY d.fecha DESC, d.id DESC
        """
    )
    return [dict(row) for row in db.execute(q).mappings().all()]


@router.get("/dias/{dia_id}")
def obtener_dia(dia_id: int, db = Depends(db_dep)) -> dict:
    d = db.execute(text("SELECT id, fecha, nota FROM planilla_dias WHERE id=:id"), {"id": dia_id}).mappings().first()
    if not d:
        raise HTTPException(404, "Día no encontrado")
    lineas = db.execute(text(
        """
        SELECT l.id, l.empleado_id, e.nombre AS empleado_nombre, l.tarifa_base_crc,
               l.horas, l.horas_extra, l.horas_doble, l.total_crc
        FROM planilla_lineas l
        LEFT JOIN empleado e ON e.id = l.empleado_id
        WHERE l.planilla_dia_id = :id
        ORDER BY e.nombre
        """
    ), {"id": dia_id}).mappings().all()
    return {**d, "lineas": list(lineas)}


@router.delete("/dias/{dia_id}")
def eliminar_dia(dia_id: int, db = Depends(db_dep)) -> dict:
    res = db.execute(text("DELETE FROM planilla_dias WHERE id=:id"), {"id": dia_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Día no encontrado")
    return {"ok": True}


@router.post("/dias/{dia_id}/lineas")
def crear_linea(dia_id: int, payload: dict, db = Depends(db_dep)) -> dict:
    emp_id = payload.get("empleado_id")
    if not emp_id:
        raise HTTPException(400, "empleado_id requerido")
    tarifa = float(payload.get("tarifa_base_crc") or 0)
    h = float(payload.get("horas") or 0)
    he = float(payload.get("horas_extra") or 0)
    hd = float(payload.get("horas_doble") or 0)
    total = calc_total(tarifa, h, he, hd)
    res = db.execute(text(
        """
        INSERT INTO planilla_lineas (planilla_dia_id, empleado_id, tarifa_base_crc, horas, horas_extra, horas_doble, total_crc)
        VALUES (:d, :e, :t, :h, :he, :hd, :tot)
        """
    ), {"d": dia_id, "e": emp_id, "t": tarifa, "h": h, "he": he, "hd": hd, "tot": total})
    db.commit()
    return {"id": res.lastrowid, "total_crc": total}


@router.put("/lineas/{linea_id}")
def actualizar_linea(linea_id: int, payload: dict, db = Depends(db_dep)) -> dict:
    row = db.execute(text("SELECT * FROM planilla_lineas WHERE id=:id"), {"id": linea_id}).mappings().first()
    if not row:
        raise HTTPException(404, "Línea no encontrada")
    tarifa = float(payload.get("tarifa_base_crc") if payload.get("tarifa_base_crc") is not None else row["tarifa_base_crc"]) 
    h = float(payload.get("horas") if payload.get("horas") is not None else row["horas"]) 
    he = float(payload.get("horas_extra") if payload.get("horas_extra") is not None else row["horas_extra"]) 
    hd = float(payload.get("horas_doble") if payload.get("horas_doble") is not None else row["horas_doble"]) 
    total = calc_total(tarifa, h, he, hd)
    db.execute(text(
        """
        UPDATE planilla_lineas
        SET tarifa_base_crc=:t, horas=:h, horas_extra=:he, horas_doble=:hd, total_crc=:tot,
            empleado_id = COALESCE(:emp, empleado_id)
        WHERE id=:id
        """
    ), {"id": linea_id, "t": tarifa, "h": h, "he": he, "hd": hd, "tot": total, "emp": payload.get("empleado_id")})
    db.commit()
    return {"ok": True, "total_crc": total}


@router.delete("/lineas/{linea_id}")
def eliminar_linea(linea_id: int, db = Depends(db_dep)) -> dict:
    res = db.execute(text("DELETE FROM planilla_lineas WHERE id=:id"), {"id": linea_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Línea no encontrada")
    return {"ok": True}

