from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep
from ..services.inventory import insert_inv_mov
from datetime import datetime

router = APIRouter()

@router.post("/tandas")
def crear_tanda(payload: dict, db: Session = Depends(db_dep)):
    q = text("""
        INSERT INTO tanda (fecha,receta_id,ubicacion_origen_id,ubicacion_destino_id,nota,created_by)
        VALUES (:fecha,:receta_id,:ubicacion_origen_id,:ubicacion_destino_id,:nota,:created_by)
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

@router.post("/tandas/{tanda_id}/consumos")
def consumo(tanda_id: int, item: dict, db: Session = Depends(db_dep)):
    item["tanda_id"] = tanda_id
    db.execute(text("""
        INSERT INTO tanda_consumo (tanda_id,producto_id,uom_id,cantidad)
        VALUES (:tanda_id,:producto_id,:uom_id,:cantidad)
    """), item)
    insert_inv_mov(
        db, fecha=datetime.now(), producto_id=item["producto_id"], uom_id=item["uom_id"],
        tipo='OUT', cantidad=item["cantidad"], motivo='CONSUMO_RECETA', ref_tabla='tanda_consumo'
    )
    db.commit(); return {"ok": True}

@router.post("/tandas/{tanda_id}/salidas")
def salida(tanda_id: int, item: dict, db: Session = Depends(db_dep)):
    item["tanda_id"] = tanda_id
    db.execute(text("""
        INSERT INTO tanda_salida (tanda_id,producto_id,uom_id,cantidad)
        VALUES (:tanda_id,:producto_id,:uom_id,:cantidad)
    """), item)
    insert_inv_mov(
        db, fecha=datetime.now(), producto_id=item["producto_id"], uom_id=item["uom_id"],
        tipo='IN', cantidad=item["cantidad"], motivo='PRODUCCION_SALIDA', ref_tabla='tanda_salida'
    )
    db.commit(); return {"ok": True}
