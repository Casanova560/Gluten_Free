from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.get("/")
def list_productos(
    tipo: str | None = Query(None, regex="^(MP|PT)$"),
    q: str | None = Query(None),
    db: Session = Depends(db_dep)
):
    base = "SELECT id, sku, nombre, tipo, uom_base_id, activo FROM producto WHERE 1=1"
    params = {}
    if tipo:
        base += " AND tipo = :tipo"; params["tipo"] = tipo
    if q:
        base += " AND (sku LIKE :q OR nombre LIKE :q)"; params["q"] = f"%{q}%"
    base += " ORDER BY nombre"
    rows = db.execute(text(base), params)
    return [dict(r) for r in rows.mappings()]

@router.post("/")
def create_producto(payload: dict, db: Session = Depends(db_dep)):
    sql = text("""
        INSERT INTO producto (sku,nombre,tipo,uom_base_id,activo)
        VALUES (:sku,:nombre,:tipo,:uom_base_id, COALESCE(:activo,1))
    """)
    db.execute(sql, payload); db.commit()
    new_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
    return {"id": new_id}
