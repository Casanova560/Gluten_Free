# app/routers/recetas_read.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.get("/{receta_id}/ingredientes")
def get_ingredientes(receta_id: int, db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, cantidad, nota
        FROM receta_det
        WHERE receta_id = :rid
        ORDER BY id
    """), {"rid": receta_id}).mappings()
    return [dict(r) for r in rows]

@router.get("/{receta_id}/salidas")
def get_salidas(receta_id: int, db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, rendimiento AS cantidad, nota
        FROM receta_salida
        WHERE receta_id = :rid
        ORDER BY id
    """), {"rid": receta_id}).mappings()
    return [dict(r) for r in rows]
