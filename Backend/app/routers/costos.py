# app/routers/costos.py
from fastapi import APIRouter, Depends, Query
from typing import Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..db import get_db

router = APIRouter(prefix="/costos", tags=["costos"])

@router.get("/mp")
def costos_mp(ids: List[int] = Query(...), fecha: Optional[str] = None, db: Session = Depends(get_db)) -> Dict[int, float]:
    if not ids:
        return {}
    params = {"ids": tuple(ids)}
    if fecha:
        params["fecha"] = fecha
        sql = text("""
            SELECT p.id AS producto_id,
                   fn_costo_mp_al(CAST(:fecha AS DATE), p.id) AS costo_unitario_crc
            FROM producto p
            WHERE p.id IN :ids AND p.tipo = 'MP'
        """)
    else:
        sql = text("""
            SELECT producto_id, costo_unitario_crc
            FROM v_costo_mp_actual
            WHERE producto_id IN :ids
        """)
    rows = db.execute(sql, params).fetchall()
    return {int(r[0]): float(r[1] or 0) for r in rows}
