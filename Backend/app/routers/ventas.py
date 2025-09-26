from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep
from ..services.inventory import insert_inv_mov
from datetime import datetime

router = APIRouter()

@router.post("/")
def create_venta(payload: dict, db: Session = Depends(db_dep)):
    if payload.get("condicion_pago") == "CREDITO" and payload.get("dias_credito"):
        payload["fecha_limite"] = db.execute(
            text("SELECT DATE_ADD(:f, INTERVAL :d DAY)"),
            {"f": payload["fecha"], "d": int(payload["dias_credito"])}
        ).scalar()
    q = text("""
        INSERT INTO venta (fecha,cliente_id,moneda,tipo_cambio,condicion_pago,dias_credito,fecha_limite,estado_cobro_pago,ruta_id,nota,created_by)
        VALUES (:fecha,:cliente_id,:moneda,:tipo_cambio,:condicion_pago,:dias_credito,:fecha_limite,COALESCE(:estado_cobro_pago,'PENDIENTE'),:ruta_id,:nota,:created_by)
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

@router.post("/{venta_id}/items")
def add_item(venta_id: int, item: dict, db: Session = Depends(db_dep)):
    item["venta_id"] = venta_id
    db.execute(text("""
        INSERT INTO venta_det (venta_id,producto_id,uom_id,cantidad,precio_unitario_crc,descuento_crc)
        VALUES (:venta_id,:producto_id,:uom_id,:cantidad,:precio_unitario_crc,COALESCE(:descuento_crc,0))
    """), item)
    insert_inv_mov(
        db, fecha=datetime.now(), producto_id=item["producto_id"], uom_id=item["uom_id"],
        tipo='OUT', cantidad=item["cantidad"], motivo='VENTA', ref_tabla='venta_det'
    )
    db.commit(); return {"ok": True}

@router.post("/{venta_id}/cobro")
def registrar_cobro(venta_id: int, payload: dict, db: Session = Depends(db_dep)):
    payload["venta_id"] = venta_id
    db.execute(text("""
        INSERT INTO cobro (venta_id,fecha,monto_crc,metodo,referencia,nota)
        VALUES (:venta_id,:fecha,:monto_crc,:metodo,:referencia,:nota)
    """), payload)
    db.commit(); return {"ok": True}

@router.get("/{venta_id}/totales")
def totales(venta_id: int, db: Session = Depends(db_dep)):
    row = db.execute(text("SELECT total_crc FROM v_venta_totales WHERE id=:id"), {"id": venta_id}).first()
    return {"total_crc": row[0] if row else 0}
