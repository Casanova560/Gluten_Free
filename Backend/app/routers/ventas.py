
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from ..utils.deps import db_dep

router = APIRouter(prefix="/ventas", tags=["ventas"])


@router.get("")
def listar_ventas(
    desde: str | None = Query(None, description="Filtrar fecha >= YYYY-MM-DD"),
    hasta: str | None = Query(None, description="Filtrar fecha <= YYYY-MM-DD"),
    include: List[str] | None = Query(None, description="items, totales"),
    db = Depends(db_dep)
):
    params: dict[str, object] = {}
    filtros: list[str] = []
    if desde:
        filtros.append("v.fecha >= :desde")
        params["desde"] = desde
    if hasta:
        filtros.append("v.fecha <= :hasta")
        params["hasta"] = hasta

    base = """
        SELECT v.id, v.fecha, v.cliente_id, c.nombre AS cliente_nombre,
               v.condicion_pago, v.dias_credito, v.moneda, v.nota,
               COALESCE(vt.total_crc, 0) AS total_crc
        FROM venta v
        LEFT JOIN cliente c ON c.id = v.cliente_id
        LEFT JOIN (
            SELECT venta_id,
                   SUM((cantidad * precio_unitario_crc) - COALESCE(descuento_crc, 0)) AS total_crc
            FROM venta_det
            GROUP BY venta_id
        ) vt ON vt.venta_id = v.id
    """
    if filtros:
        base += " WHERE " + " AND ".join(filtros)
    base += " ORDER BY v.fecha DESC, v.id DESC"

    registros = db.execute(text(base), params).mappings().all()
    ventas = [dict(v) for v in registros]
    include_set = {item.lower() for item in (include or [])}

    if ventas and "items" in include_set:
        id_params = {f"id{i}": venta["id"] for i, venta in enumerate(ventas)}
        in_clause = ", ".join(f":id{i}" for i in range(len(id_params)))
        items_sql = text(f"""
            SELECT d.venta_id, d.id, d.producto_id, p.nombre AS producto_nombre,
                   d.uom_id, u.nombre AS uom_nombre,
                   d.cantidad, d.precio_unitario_crc, d.descuento_crc
            FROM venta_det d
            LEFT JOIN producto p ON p.id = d.producto_id
            LEFT JOIN uom u ON u.id = d.uom_id
            WHERE d.venta_id IN ({in_clause})
            ORDER BY d.venta_id, d.id
        """)
        items = db.execute(items_sql, id_params).mappings().all()
        items_by: dict[int, list[dict]] = {}
        for it in items:
            items_by.setdefault(it["venta_id"], []).append(dict(it))
        for venta in ventas:
            venta["items"] = items_by.get(venta["id"], [])

    return ventas


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
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, cantidad, tipo, motivo, ref_tabla, ref_id)
        SELECT v.fecha, d.producto_id, d.uom_id, -d.cantidad, 'OUT', 'VENTA', 'venta', d.venta_id
        FROM venta v JOIN venta_det d ON d.venta_id = v.id
        WHERE d.id = :det_id
    """), {"det_id": det.lastrowid})
    db.commit()
    return {"ok": True}


@router.get("/{venta_id}/totales")
def totales(venta_id: int, db = Depends(db_dep)):
    row = db.execute(text("""
        SELECT SUM(cantidad * precio_unitario_crc - COALESCE(descuento_crc, 0)) AS total_crc
        FROM venta_det WHERE venta_id = :id
    """), {"id": venta_id}).mappings().first()
    return row or {"total_crc": 0}
