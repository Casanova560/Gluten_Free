from fastapi import APIRouter, Depends
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/reportes", tags=["reportes"])

@router.get("/dashboard")
def dashboard(db = Depends(db_dep)):
    ventas = db.execute(text("""
        SELECT DATE(v.fecha) AS fecha,
               SUM(d.cantidad*d.precio_unitario_crc - COALESCE(d.descuento_crc,0)) AS total_crc
        FROM venta v
        LEFT JOIN venta_det d ON d.venta_id = v.id
        WHERE v.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(v.fecha)
        ORDER BY fecha DESC
    """)).mappings().all()
    compras = db.execute(text("""
        SELECT DATE(c.fecha) AS fecha,
               SUM(d.cantidad*d.costo_unitario_crc - COALESCE(d.descuento_crc,0)) AS total_crc
        FROM compra c
        LEFT JOIN compra_det d ON d.compra_id = c.id
        WHERE c.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(c.fecha)
        ORDER BY fecha DESC
    """)).mappings().all()
    margen = []  # si quieres lo calculamos por mes luego
    return {"ventas": ventas, "compras": compras, "margen": margen}
