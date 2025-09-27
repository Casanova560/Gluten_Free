from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/uom", tags=["uom"])

@router.get("")
def list_uom(db = Depends(db_dep)):
    return db.execute(text("SELECT id, codigo, nombre FROM uom ORDER BY nombre")).mappings().all()

@router.post("")
def create_uom(payload: dict, db = Depends(db_dep)):
    codigo = (payload.get("codigo") or "").strip()
    nombre = (payload.get("nombre") or "").strip()
    if not codigo or not nombre:
        raise HTTPException(400, "codigo y nombre son obligatorios")
    res = db.execute(text(
        "INSERT INTO uom (codigo, nombre) VALUES (:codigo, :nombre)"
    ), {"codigo": codigo, "nombre": nombre})
    db.commit()
    uid = res.lastrowid
    return db.execute(text("SELECT id, codigo, nombre FROM uom WHERE id=:id"), {"id": uid}).mappings().first()
