from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep
from ..services.inventory import insert_inv_mov
from datetime import datetime

router = APIRouter()

@router.get("/mp")
def existencias_mp(db: Session = Depends(db_dep)):
    rows = db.execute(text("SELECT * FROM v_existencias_mp ORDER BY nombre"))
    return [dict(r) for r in rows.mappings()]

@router.get("/pt")
def existencias_pt(db: Session = Depends(db_dep)):
    rows = db.execute(text("SELECT * FROM v_existencias_pt ORDER BY nombre"))
    return [dict(r) for r in rows.mappings()]

@router.get("/resumen")
def inv_resumen(db: Session = Depends(db_dep)):
    rows = db.execute(text("SELECT * FROM v_inventario_resumen"))
    return [dict(r) for r in rows.mappings()]

@router.post("/merma")
def registrar_merma(payload: dict, db: Session = Depends(db_dep)):
    db.execute(text("""
        INSERT INTO merma (fecha,producto_id,uom_id,cantidad,ubicacion_id,motivo,nota)
        VALUES (:fecha,:producto_id,:uom_id,:cantidad,:ubicacion_id,:motivo,:nota)
    """), payload)
    insert_inv_mov(
        db, fecha=datetime.now(), producto_id=payload["producto_id"], uom_id=payload["uom_id"],
        tipo='OUT', cantidad=payload["cantidad"], motivo='MERMA', ref_tabla='merma'
    )
    db.commit(); return {"ok": True}

@router.get("/kardex")
def kardex(producto_id: int, db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT * FROM inv_mov WHERE producto_id = :pid ORDER BY fecha DESC
    """), {"pid": producto_id})
    return [dict(r) for r in rows.mappings()]
