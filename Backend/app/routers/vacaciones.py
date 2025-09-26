from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.post("/")
def solicitar(payload: dict, db: Session = Depends(db_dep)):
    db.execute(text("""
        INSERT INTO vacaciones (empleado_id,fecha_inicio,fecha_fin,dias_total,estado,nota)
        VALUES (:empleado_id,:fecha_inicio,:fecha_fin,:dias_total,COALESCE(:estado,'SOLICITADO'),:nota)
    """), payload)
    db.commit(); return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

@router.get("/")
def listar(db: Session = Depends(db_dep)):
    rows = db.execute(text("SELECT * FROM vacaciones ORDER BY fecha_inicio DESC"))
    return [dict(r) for r in rows.mappings()]
