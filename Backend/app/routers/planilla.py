from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.post("/semana")
def crear_semana(payload: dict, db: Session = Depends(db_dep)):
    db.execute(text("""
        INSERT INTO planilla_semana (semana_inicio,nota)
        VALUES (:semana_inicio,:nota)
    """), payload)
    db.commit(); return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

@router.post("/{planilla_id}/detalle")
def add_detalle(planilla_id: int, payload: dict, db: Session = Depends(db_dep)):
    payload["planilla_id"] = planilla_id
    db.execute(text("""
        INSERT INTO planilla_det (planilla_id,empleado_id,persona,rol,horas_previstas,horas_efectivas,tarifa_hora_crc,estado_pago)
        VALUES (:planilla_id,:empleado_id,:persona,:rol,COALESCE(:horas_previstas,0),COALESCE(:horas_efectivas,0),COALESCE(:tarifa_hora_crc,0),COALESCE(:estado_pago,'PENDIENTE'))
    """), payload)
    db.commit(); return {"ok": True}
