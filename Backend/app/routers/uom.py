from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.get("/")
def list_uom(db: Session = Depends(db_dep)):
    rows = db.execute(text("SELECT id, codigo, nombre FROM uom ORDER BY nombre"))
    return [dict(r) for r in rows.mappings()]

@router.post("/")
def create_uom(payload: dict, db: Session = Depends(db_dep)):
    q = text("INSERT INTO uom (codigo,nombre) VALUES (:codigo,:nombre)")
    db.execute(q, payload); db.commit()
    new_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
    return {"id": new_id}
