from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep
from ..services.inventory import insert_inv_mov
from datetime import datetime

router = APIRouter()

@router.post("/")
def create_compra(payload: dict, db: Session = Depends(db_dep)):
    # fecha_limite si crédito
    if payload.get("condicion_pago") == "CREDITO" and payload.get("dias_credito"):
        payload["fecha_limite"] = db.execute(
            text("SELECT DATE_ADD(:f, INTERVAL :d DAY)"),
            {"f": payload["fecha"], "d": int(payload["dias_credito"])}
        ).scalar()
    q = text("""
        INSERT INTO compra (fecha,proveedor_id,moneda,tipo_cambio,condicion_pago,dias_credito,fecha_limite,estado_cobro_pago,nota,created_by)
        VALUES (:fecha,:proveedor_id,:moneda,:tipo_cambio,:condicion_pago,:dias_credito,:fecha_limite,COALESCE(:estado_cobro_pago,'PENDIENTE'),:nota,:created_by)
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

@router.post("/{compra_id}/items")
def add_item(compra_id: int, item: dict, db: Session = Depends(db_dep)):
    item["compra_id"] = compra_id
    db.execute(text("""
        INSERT INTO compra_det (compra_id,producto_id,uom_id,cantidad,costo_unitario_crc,descuento_crc)
        VALUES (:compra_id,:producto_id,:uom_id,:cantidad,:costo_unitario_crc,COALESCE(:descuento_crc,0))
    """), item)
    insert_inv_mov(
        db, fecha=datetime.now(), producto_id=item["producto_id"], uom_id=item["uom_id"],
        tipo='IN', cantidad=item["cantidad"], motivo='COMPRA', ref_tabla='compra_det'
    )
    db.commit(); return {"ok": True}

@router.post("/{compra_id}/pago")
def registrar_pago(compra_id: int, payload: dict, db: Session = Depends(db_dep)):
    payload["compra_id"] = compra_id
    db.execute(text("""
        INSERT INTO pago (compra_id,fecha,monto_crc,metodo,referencia,nota)
        VALUES (:compra_id,:fecha,:monto_crc,:metodo,:referencia,:nota)
    """), payload)
    db.commit(); return {"ok": True}

@router.get("/{compra_id}/totales")
def totales(compra_id: int, db: Session = Depends(db_dep)):
    row = db.execute(text("SELECT total_crc FROM v_compra_totales WHERE id=:id"), {"id": compra_id}).first()
    return {"total_crc": row[0] if row else 0}
