from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.get("/cxc")
def cxc(cliente_id: int | None = None, vencido: str | None = None, db: Session = Depends(db_dep)):
    base = "SELECT * FROM v_cxc WHERE 1=1"; params = {}
    if cliente_id:
        base += " AND cliente_id = :cid"; params["cid"] = cliente_id
    if vencido == "si":
        base += " AND dias_vencido > 0"
    rows = db.execute(text(base), params)
    return [dict(r) for r in rows.mappings()]

@router.get("/cxp")
def cxp(proveedor_id: int | None = None, vencido: str | None = None, db: Session = Depends(db_dep)):
    base = "SELECT * FROM v_cxp WHERE 1=1"; params = {}
    if proveedor_id:
        base += " AND proveedor_id = :pid"; params["pid"] = proveedor_id
    if vencido == "si":
        base += " AND dias_vencido > 0"
    rows = db.execute(text(base), params)
    return [dict(r) for r in rows.mappings()]

@router.get("/cxc/tramos")
def cxc_tramos(db: Session = Depends(db_dep)):
    rows = db.execute(text("SELECT * FROM v_cxc_tramos"))
    return [dict(r) for r in rows.mappings()]

@router.get("/cxp/tramos")
def cxp_tramos(db: Session = Depends(db_dep)):
    rows = db.execute(text("SELECT * FROM v_cxp_tramos"))
    return [dict(r) for r in rows.mappings()]
