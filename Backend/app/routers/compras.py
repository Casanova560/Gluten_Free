
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from ..utils.deps import db_dep

router = APIRouter(prefix="/compras", tags=["compras"])


@router.get("")
def listar_compras(
    desde: str | None = Query(None, description="Filtrar fecha >= YYYY-MM-DD"),
    hasta: str | None = Query(None, description="Filtrar fecha <= YYYY-MM-DD"),
    include: List[str] | None = Query(None, description="items, totales"),
    db = Depends(db_dep)
):
    params: dict[str, object] = {}
    filtros: list[str] = []
    if desde:
        filtros.append("c.fecha >= :desde")
        params["desde"] = desde
    if hasta:
        filtros.append("c.fecha <= :hasta")
        params["hasta"] = hasta

    base = """
        SELECT c.id, c.fecha, c.proveedor_id, p.nombre AS proveedor_nombre,
               c.condicion_pago, c.dias_credito, c.moneda, c.nota,
               COALESCE(ct.total_crc, 0) AS total_crc
        FROM compra c
        LEFT JOIN proveedor p ON p.id = c.proveedor_id
        LEFT JOIN (
            SELECT compra_id,
                   SUM((cantidad * costo_unitario_crc) - COALESCE(descuento_crc, 0)) AS total_crc
            FROM compra_det
            GROUP BY compra_id
        ) ct ON ct.compra_id = c.id
    """
    if filtros:
        base += " WHERE " + " AND ".join(filtros)
    base += " ORDER BY c.fecha DESC, c.id DESC"

    registros = db.execute(text(base), params).mappings().all()
    compras = [dict(r) for r in registros]
    include_set = {item.lower() for item in (include or [])}

    if compras and "items" in include_set:
        id_params = {f"id{i}": compra["id"] for i, compra in enumerate(compras)}
        in_clause = ", ".join(f":id{i}" for i in range(len(id_params)))
        items_sql = text(f"""
            SELECT d.compra_id, d.id, d.producto_id, pr.nombre AS producto_nombre,
                   d.uom_id, u.nombre AS uom_nombre,
                   d.cantidad, d.costo_unitario_crc, d.descuento_crc
            FROM compra_det d
            LEFT JOIN producto pr ON pr.id = d.producto_id
            LEFT JOIN uom u ON u.id = d.uom_id
            WHERE d.compra_id IN ({in_clause})
            ORDER BY d.compra_id, d.id
        """)
        items = db.execute(items_sql, id_params).mappings().all()
        items_by: dict[int, list[dict]] = {}
        for it in items:
            items_by.setdefault(it["compra_id"], []).append(dict(it))
        for compra in compras:
            compra["items"] = items_by.get(compra["id"], [])

    return compras


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
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, cantidad, tipo, motivo, ref_tabla, ref_id, costo_unitario_crc)
        SELECT c.fecha, d.producto_id, d.uom_id, d.cantidad, 'IN', 'COMPRA', 'compra', d.compra_id, d.costo_unitario_crc
        FROM compra c JOIN compra_det d ON d.compra_id = c.id
        WHERE d.id = :det_id
    """), {"det_id": det.lastrowid})
    db.commit()
    return {"ok": True}


@router.get("/{compra_id}/totales")
def totales(compra_id: int, db = Depends(db_dep)):
    row = db.execute(text("""
        SELECT SUM(cantidad * costo_unitario_crc - COALESCE(descuento_crc, 0)) AS total_crc
        FROM compra_det WHERE compra_id = :id
    """), {"id": compra_id}).mappings().first()
    return row or {"total_crc": 0}
