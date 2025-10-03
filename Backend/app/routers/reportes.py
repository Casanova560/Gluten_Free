from fastapi import APIRouter, Depends
from sqlalchemy import text

from ..utils.deps import db_dep

router = APIRouter(prefix="/reportes", tags=["reportes"])

@router.get("/dashboard")
def dashboard(mes: str | None = None, db = Depends(db_dep)):
    if mes:
        ventas = db.execute(text("""
            SELECT DATE(v.fecha) AS fecha,
                   SUM(d.cantidad*d.precio_unitario_crc - COALESCE(d.descuento_crc,0)) AS total_crc
            FROM venta v
            LEFT JOIN venta_det d ON d.venta_id = v.id
            WHERE DATE_FORMAT(v.fecha,'%Y-%m') = :mes
            GROUP BY DATE(v.fecha)
            ORDER BY fecha DESC
        """), {"mes": mes}).mappings().all()
        compras = db.execute(text("""
            SELECT DATE(c.fecha) AS fecha,
                   SUM(d.cantidad*d.costo_unitario_crc - COALESCE(d.descuento_crc,0)) AS total_crc
            FROM compra c
            LEFT JOIN compra_det d ON d.compra_id = c.id
            WHERE DATE_FORMAT(c.fecha,'%Y-%m') = :mes
            GROUP BY DATE(c.fecha)
            ORDER BY fecha DESC
        """), {"mes": mes}).mappings().all()
    else:
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


@router.get("/resumen-ventas")
def resumen_ventas(
    desde: str | None = None,
    hasta: str | None = None,
    top: int | None = None,
    db = Depends(db_dep),
):
    where = []
    params: dict[str, object] = {}
    if desde:
        where.append("v.fecha >= :desde")
        params["desde"] = desde
    if hasta:
        where.append("v.fecha <= :hasta")
        params["hasta"] = hasta
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    limit_sql = ""
    if top and top > 0:
        limit_sql = " LIMIT :top"
        params["top"] = top

    cliente_sql = text(
        f"""
        SELECT
            v.cliente_id,
            COALESCE(c.nombre, CONCAT('Cliente #', v.cliente_id)) AS cliente_nombre,
            COUNT(DISTINCT v.id) AS facturas,
            SUM(d.cantidad) AS unidades,
            SUM(d.cantidad * d.precio_unitario_crc - COALESCE(d.descuento_crc, 0)) AS total_crc
        FROM venta v
        LEFT JOIN venta_det d ON d.venta_id = v.id
        LEFT JOIN cliente c ON c.id = v.cliente_id
        {where_sql}
        GROUP BY v.cliente_id, cliente_nombre
        ORDER BY total_crc DESC
        {limit_sql}
        """
    )

    producto_sql = text(
        f"""
        SELECT
            d.producto_id,
            COALESCE(p.nombre, CONCAT('Producto #', d.producto_id)) AS producto_nombre,
            SUM(d.cantidad) AS unidades,
            SUM(d.cantidad * d.precio_unitario_crc - COALESCE(d.descuento_crc, 0)) AS total_crc
        FROM venta_det d
        LEFT JOIN venta v ON v.id = d.venta_id
        LEFT JOIN producto p ON p.id = d.producto_id
        {where_sql}
        GROUP BY d.producto_id, producto_nombre
        ORDER BY total_crc DESC
        {limit_sql}
        """
    )

    clientes = db.execute(cliente_sql, params).mappings().all()
    productos = db.execute(producto_sql, params).mappings().all()
    return {"clientes": clientes, "productos": productos}
