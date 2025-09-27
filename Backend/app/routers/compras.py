from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/compras", tags=["compras"])

@router.post("")
def crear_compra(payload: dict, db = Depends(db_dep)):
    data = {
        "fecha": payload.get("fecha"),
        "proveedor_id": payload.get("proveedor_id"),
        "condicion_pago": payload.get("condicion_pago"),
        "dias_credito": payload.get("dias_credito"),
        "moneda": payload.get("moneda") or "CRC",
        "nota": payload.get("nota"),
    }
    if not data["fecha"] or not data["proveedor_id"]:
        raise HTTPException(400, "fecha y proveedor_id son obligatorios")
    res = db.execute(text("""
        INSERT INTO compra (fecha, proveedor_id, condicion_pago, dias_credito, moneda, nota)
        VALUES (:fecha, :proveedor_id, :condicion_pago, :dias_credito, :moneda, :nota)
    """), data)
    db.commit()
    return {"id": res.lastrowid}

@router.post("/{compra_id}/items")
def agregar_item(compra_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "compra_id": compra_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": payload.get("cantidad"),
        "costo_unitario_crc": payload.get("costo_unitario_crc"),
        "descuento_crc": payload.get("descuento_crc"),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    det = db.execute(text("""
        INSERT INTO compra_det (compra_id, producto_id, uom_id, cantidad, costo_unitario_crc, descuento_crc)
        VALUES (:compra_id, :producto_id, :uom_id, :cantidad, :costo_unitario_crc, :descuento_crc)
    """), data)
    # inventario: entrada
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, cantidad, tipo, ref, ref_id, costo_unitario_crc)
        SELECT c.fecha, d.producto_id, d.uom_id, d.cantidad, 'COMPRA', 'compra', d.compra_id, d.costo_unitario_crc
        FROM compra c JOIN compra_det d ON d.compra_id=c.id
        WHERE d.id=:det_id
    """), {"det_id": det.lastrowid})
    db.commit()
    return {"ok": True}

@router.get("/{compra_id}/totales")
def totales(compra_id: int, db = Depends(db_dep)):
    row = db.execute(text("""
        SELECT SUM(cantidad*costo_unitario_crc - COALESCE(descuento_crc,0)) AS total_crc
        FROM compra_det WHERE compra_id=:id
    """), {"id": compra_id}).mappings().first()
    return row or {"total_crc": 0}
