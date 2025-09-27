from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/costeo", tags=["costeo"])

def _cfg_pct(db):
    row = db.execute(text("SELECT pct FROM config_costeo LIMIT 1")).mappings().first()
    return float(row["pct"]) if row else 0.0

@router.get("/recetas/{receta_id}")
def costear_receta(
    receta_id: int,
    rendimiento: float | None = Query(None),
    pct_ind: float | None = Query(None),
    db = Depends(db_dep),
):
    ings = db.execute(text("""
        SELECT i.producto_id, p.nombre, i.uom_id, i.cantidad
        FROM receta_det i
        JOIN producto p ON p.id = i.producto_id
        WHERE i.receta_id = :id
    """), {"id": receta_id}).mappings().all()
    if not ings:
        raise HTTPException(404, "receta sin ingredientes")

    ids = tuple({int(r["producto_id"]) for r in ings})
    cost_map = {}
    if ids:
        q = text("""
            SELECT d.producto_id AS id,
                   (SELECT d2.costo_unitario_crc
                    FROM compra_det d2
                    JOIN compra c2 ON c2.id = d2.compra_id
                    WHERE d2.producto_id = d.producto_id
                    ORDER BY c2.fecha DESC, d2.id DESC
                    LIMIT 1) AS costo_unitario_crc
            FROM (SELECT DISTINCT producto_id FROM compra_det WHERE producto_id IN :ids) d
        """)
        for r in db.execute(q, {"ids": ids}).mappings().all():
            cost_map[int(r["id"])] = float(r["costo_unitario_crc"] or 0)

    rows, directo = [], 0.0
    for it in ings:
        unit = float(cost_map.get(int(it["producto_id"]), 0))
        total = unit * float(it["cantidad"] or 0)
        rows.append({
            "producto_id": it["producto_id"], "nombre": it["nombre"],
            "cantidad": it["cantidad"], "costo_unitario_crc": unit, "costo_total_crc": total
        })
        directo += total

    if pct_ind is None:
        pct_ind = _cfg_pct(db)
    indirecto = directo * float(pct_ind or 0)
    total = directo + indirecto

    if not rendimiento:
        outs = db.execute(text("SELECT SUM(rendimiento) AS rend FROM receta_salida WHERE receta_id=:id"), {"id": receta_id}).mappings().first()
        rendimiento = float(outs["rend"] or 0)
    unitario = (total / rendimiento) if (rendimiento and rendimiento > 0) else None

    return {
        "ingredientes": rows,
        "costo_directo_crc": directo,
        "costo_indirecto_crc": indirecto,
        "costo_total_crc": total,
        "rendimiento": rendimiento,
        "unitario_crc": unitario,
    }

@router.get("/tandas/{tanda_id}")
def costear_tanda(tanda_id: int, db = Depends(db_dep)):
    cons = db.execute(text("""
        SELECT producto_id, SUM(cantidad) AS cantidad
        FROM tanda_consumo WHERE tanda_id=:id
        GROUP BY producto_id
    """), {"id": tanda_id}).mappings().all()
    if not cons:
        return {"costo_directo_crc": 0, "costo_indirecto_crc": 0, "costo_total_crc": 0, "unitario_crc": None, "consumos": []}

    ids = tuple({int(r["producto_id"]) for r in cons})
    cost_map = {}
    if ids:
        q = text("""
            SELECT d.producto_id AS id,
                   (SELECT d2.costo_unitario_crc
                    FROM compra_det d2
                    JOIN compra c2 ON c2.id = d2.compra_id
                    WHERE d2.producto_id = d.producto_id
                    ORDER BY c2.fecha DESC, d2.id DESC
                    LIMIT 1) AS costo_unitario_crc
            FROM (SELECT DISTINCT producto_id FROM compra_det WHERE producto_id IN :ids) d
        """)
        for r in db.execute(q, {"ids": ids}).mappings().all():
            cost_map[int(r["id"])] = float(r["costo_unitario_crc"] or 0)

    rows, directo = [], 0.0
    for it in cons:
        unit = float(cost_map.get(int(it["producto_id"]), 0))
        total = unit * float(it["cantidad"] or 0)
        nombre = db.execute(text("SELECT nombre FROM producto WHERE id=:id"), {"id": it["producto_id"]}).scalar() or f"#{it['producto_id']}"
        rows.append({
            "producto_id": it["producto_id"], "nombre": nombre,
            "cantidad": it["cantidad"], "costo_unitario_crc": unit, "costo_total_crc": total
        })
        directo += total

    pct = _cfg_pct(db)
    indirecto = directo * pct
    total = directo + indirecto

    outs = db.execute(text("SELECT SUM(cantidad) FROM tanda_salida WHERE tanda_id=:id"), {"id": tanda_id}).scalar()
    unitario = (total / float(outs)) if outs else None

    return {
        "consumos": rows,
        "costo_directo_crc": directo,
        "costo_indirecto_crc": indirecto,
        "costo_total_crc": total,
        "unitario_crc": unitario,
    }
