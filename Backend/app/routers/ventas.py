from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/ventas", tags=["ventas"])

@router.post("")
def crear_venta(payload: dict, db = Depends(db_dep)):
    data = {
        "fecha": payload.get("fecha"),
        "cliente_id": payload.get("cliente_id"),
        "condicion_pago": payload.get("condicion_pago"),
        "dias_credito": payload.get("dias_credito"),
        "moneda": payload.get("moneda") or "CRC",
        "nota": payload.get("nota"),
    }
    if not data["fecha"] or not data["cliente_id"]:
        raise HTTPException(400, "fecha y cliente_id son obligatorios")
    res = db.execute(text("""
        INSERT INTO venta (fecha, cliente_id, condicion_pago, dias_credito, moneda, nota)
        VALUES (:fecha, :cliente_id, :condicion_pago, :dias_credito, :moneda, :nota)
    """), data)
    db.commit()
    return {"id": res.lastrowid}

@router.post("/{venta_id}/items")
def agregar_item(venta_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "venta_id": venta_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": payload.get("cantidad"),
        "precio_unitario_crc": payload.get("precio_unitario_crc"),
        "descuento_crc": payload.get("descuento_crc"),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    det = db.execute(text("""
        INSERT INTO venta_det (venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
        VALUES (:venta_id, :producto_id, :uom_id, :cantidad, :precio_unitario_crc, :descuento_crc)
    """), data)
    # inventario: salida
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, cantidad, tipo, ref, ref_id)
        SELECT v.fecha, d.producto_id, d.uom_id, -d.cantidad, 'VENTA', 'venta', d.venta_id
        FROM venta v JOIN venta_det d ON d.venta_id=v.id
        WHERE d.id=:det_id
    """), {"det_id": det.lastrowid})
    db.commit()
    return {"ok": True}

@router.get("/{venta_id}/totales")
def totales(venta_id: int, db = Depends(db_dep)):
    row = db.execute(text("""
        SELECT SUM(cantidad*precio_unitario_crc - COALESCE(descuento_crc,0)) AS total_crc
        FROM venta_det WHERE venta_id=:id
    """), {"id": venta_id}).mappings().first()
    return row or {"total_crc": 0}
