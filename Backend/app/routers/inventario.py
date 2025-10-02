from fastapi import APIRouter, Depends
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/inventario", tags=["inventario"])

@router.get("/mp")
def mp(db = Depends(db_dep)):
    # existencias = IN - OUT; totales por motivo
    return db.execute(text("""
        SELECT p.sku, p.nombre,
               COALESCE(SUM(CASE WHEN m.tipo='IN'  THEN m.cantidad WHEN m.tipo='OUT' THEN -m.cantidad ELSE 0 END),0) AS existencias,
               COALESCE(SUM(CASE WHEN m.motivo='COMPRA' THEN m.cantidad ELSE 0 END),0) AS total_comprado,
               COALESCE(SUM(CASE WHEN m.motivo='CONSUMO_RECETA' THEN m.cantidad ELSE 0 END),0) AS total_consumido
        FROM producto p
        LEFT JOIN inv_mov m ON m.producto_id = p.id
        WHERE p.tipo = 'MP'
        GROUP BY p.id
        ORDER BY p.nombre
    """)).mappings().all()

@router.get("/pt")
def pt(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT p.sku, p.nombre,
               COALESCE(SUM(CASE WHEN m.tipo='IN'  THEN m.cantidad WHEN m.tipo='OUT' THEN -m.cantidad ELSE 0 END),0) AS existencias,
               COALESCE(SUM(CASE WHEN m.motivo='PRODUCCION_SALIDA' THEN m.cantidad ELSE 0 END),0) AS total_producido,
               COALESCE(SUM(CASE WHEN m.motivo='VENTA' THEN m.cantidad ELSE 0 END),0) AS total_vendido
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
               MAX(CASE WHEN m.tipo='IN' THEN m.fecha END)  AS ultima_entrada,
               MAX(CASE WHEN m.tipo='OUT' THEN m.fecha END) AS ultima_salida,
               COALESCE(SUM(CASE WHEN m.tipo='IN'  THEN m.cantidad WHEN m.tipo='OUT' THEN -m.cantidad ELSE 0 END),0) AS existencias_mov
        FROM producto p
        LEFT JOIN inv_mov m ON m.producto_id = p.id
        GROUP BY p.id
        ORDER BY p.nombre
    """)).mappings().all()

@router.get("/mermas")
def mermas(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT DATE(m.fecha) AS fecha,
               p.nombre AS producto_nombre,
               u.nombre AS uom_nombre,
               m.cantidad AS cantidad,
               COALESCE(p.costo_estandar_crc, 0) AS costo_unitario_crc,
               m.cantidad * COALESCE(p.costo_estandar_crc, 0) AS costo_total_crc,
               m.motivo AS motivo,
               m.nota AS nota
        FROM inv_mov m
        JOIN producto p ON p.id = m.producto_id
        JOIN uom u ON u.id = m.uom_id
        WHERE m.motivo = 'MERMA'
        ORDER BY m.fecha DESC
    """)).mappings().all()

@router.post("/merma")
def merma(payload: dict, db = Depends(db_dep)):
    data = {
        "fecha": payload.get("fecha"),
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": float(payload.get("cantidad") or 0),
        "nota": payload.get("nota"),
    }
    if not data["fecha"] or not data["producto_id"] or not data["uom_id"] or data["cantidad"] <= 0:
        raise HTTPException(400, "fecha, producto_id, uom_id, cantidad > 0 requeridos")
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, tipo, cantidad, motivo, ref_tabla, ref_id, nota)
        VALUES (:fecha, :producto_id, :uom_id, 'OUT', :cantidad, 'MERMA', 'merma', NULL, :nota)
    """), data)
    db.commit()
    return {"ok": True}
