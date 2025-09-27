from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/planillas", tags=["planillas"])

@router.get("/semanas")
def listar_semanas(db = Depends(db_dep)):
    return db.execute(text(
        "SELECT id, semana_inicio, semana_fin, estado FROM planilla_semana ORDER BY semana_inicio DESC"
    )).mappings().all()

@router.post("/semanas")
def crear_semana(payload: dict, db = Depends(db_dep)):
    ini = payload.get("semana_inicio")
    fin = payload.get("semana_fin")
    if not ini or not fin:
        raise HTTPException(400, "semana_inicio y semana_fin requeridos")
    res = db.execute(text("""
        INSERT INTO planilla_semana (semana_inicio, semana_fin, estado)
        VALUES (:ini, :fin, 'ABIERTA')
    """), {"ini": ini, "fin": fin})
    db.commit()
    return {"id": res.lastrowid}

@router.get("/semanas/{semana_id}/items")
def items(semana_id: int, db = Depends(db_dep)):
    return db.execute(text("""
      SELECT d.id, d.semana_id, d.empleado_id, e.nombre AS empleado_nombre,
             d.horas_previstas, d.horas_efectivas, d.tarifa_hora_crc, d.estado_pago
      FROM planilla_det d
      JOIN empleado e ON e.id = d.empleado_id
      WHERE d.semana_id = :id
      ORDER BY e.nombre
    """), {"id": semana_id}).mappings().all()

@router.post("/semanas/{semana_id}/items")
def agregar_item(semana_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "semana_id": semana_id,
        "empleado_id": payload.get("empleado_id"),
        "horas_previstas": payload.get("horas_previstas", 0),
        "horas_efectivas": payload.get("horas_efectivas", 0),
        "tarifa_hora_crc": payload.get("tarifa_hora_crc", 0),
        "estado_pago": payload.get("estado_pago", "PENDIENTE"),
    }
    if not data["empleado_id"]:
        raise HTTPException(400, "empleado_id requerido")
    db.execute(text("""
        INSERT INTO planilla_det (semana_id, empleado_id, horas_previstas, horas_efectivas, tarifa_hora_crc, estado_pago)
        VALUES (:semana_id, :empleado_id, :horas_previstas, :horas_efectivas, :tarifa_hora_crc, :estado_pago)
    """), data)
    db.commit()
    return {"ok": True}
