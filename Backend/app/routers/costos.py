from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/costos", tags=["costos"])

@router.get("/mp")
def costos_mp(ids: str = Query(""), db = Depends(db_dep)):
    id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
    if not id_list:
        return {}
    rows = db.execute(text("""
        SELECT d.producto_id AS id,
               COALESCE((
                 SELECT d2.costo_unitario_crc
                 FROM compra_det d2
                 JOIN compra c2 ON c2.id = d2.compra_id
                 WHERE d2.producto_id = d.producto_id
                 ORDER BY c2.fecha DESC, d2.id DESC
                 LIMIT 1
               ), 0) AS costo_unitario_crc
        FROM (SELECT DISTINCT producto_id FROM compra_det WHERE producto_id IN :ids) d
    """), {"ids": tuple(id_list)}).mappings().all()
    return {str(r["id"]): float(r["costo_unitario_crc"] or 0) for r in rows}
