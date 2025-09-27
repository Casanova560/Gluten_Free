from fastapi import APIRouter, Depends
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/inventario", tags=["inventario"])

@router.get("/mp")
def mp(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT p.sku, p.nombre, SUM(m.cantidad) AS existencias,
               SUM(CASE WHEN m.tipo='COMPRA' THEN m.cantidad ELSE 0 END) AS total_comprado,
               SUM(CASE WHEN m.tipo='PROD_CONSUMO' THEN -m.cantidad ELSE 0 END) AS total_consumido
        FROM producto p
        LEFT JOIN inv_mov m ON m.producto_id = p.id
        WHERE p.tipo = 'MP'
        GROUP BY p.id
        ORDER BY p.nombre
    """)).mappings().all()

@router.get("/pt")
def pt(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT p.sku, p.nombre, SUM(m.cantidad) AS existencias,
               SUM(CASE WHEN m.tipo='PROD_SALIDA' THEN m.cantidad ELSE 0 END) AS total_producido,
               SUM(CASE WHEN m.tipo='VENTA' THEN -m.cantidad ELSE 0 END) AS total_vendido
        FROM producto p
        LEFT JOIN inv_mov m ON m.producto_id = p.id
        WHERE p.tipo = 'PT'
        GROUP BY p.id
        ORDER BY p.nombre
    """)).mappings().all()

@router.get("/resumen")
def resumen(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT p.sku, p.nombre, p.tipo,
               MAX(CASE WHEN m.cantidad>0 THEN m.fecha END) AS ultima_entrada,
               MAX(CASE WHEN m.cantidad<0 THEN m.fecha END) AS ultima_salida,
               SUM(m.cantidad) AS existencias_mov
        FROM producto p
        LEFT JOIN inv_mov m ON m.producto_id = p.id
        GROUP BY p.id
        ORDER BY p.nombre
    """)).mappings().all()

@router.post("/merma")
def merma(payload: dict, db = Depends(db_dep)):
    data = {
        "fecha": payload.get("fecha"),
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": payload.get("cantidad"),
        "nota": payload.get("nota"),
    }
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, cantidad, tipo, ref, ref_id, nota)
        VALUES (:fecha, :producto_id, :uom_id, -:cantidad, 'MERMA', 'merma', NULL, :nota)
    """), data)
    db.commit()
    return {"ok": True}
