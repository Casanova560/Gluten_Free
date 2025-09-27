# app/routers/productos.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from decimal import Decimal
from ..db import get_db
from .. import models
from ..schemas import ProductoCreate, ProductoUpdate, ProductoOut

router = APIRouter(prefix="/productos", tags=["productos"])

@router.get("", response_model=List[ProductoOut])
def list_productos(db: Session = Depends(get_db)):
    return db.execute(select(models.Producto)).scalars().all()

def _validate_mp(tipo: str, costo_estandar_crc):
    if tipo == "MP":
        if costo_estandar_crc is None:
            raise HTTPException(status_code=400,
                detail="Para Materia Prima (MP) es obligatorio 'costo_estandar_crc' (hasta que existan compras).")
        try:
            dec = Decimal(str(costo_estandar_crc))
        except Exception:
            raise HTTPException(status_code=400, detail="costo_estandar_crc inválido.")
        if dec < 0:
            raise HTTPException(status_code=400, detail="costo_estandar_crc no puede ser negativo.")

@router.post("", response_model=ProductoOut)
def create_producto(payload: ProductoCreate, db: Session = Depends(get_db)):
    sku = payload.sku or f"AUTO-{abs(hash(payload.nombre))%100000:05d}"
    _validate_mp(payload.tipo, payload.costo_estandar_crc)

    prod = models.Producto(
        sku=sku,
        nombre=payload.nombre,
        tipo=payload.tipo,
        uom_base_id=payload.uom_base_id,
        activo=bool(payload.activo) if payload.activo is not None else True,
        precio_venta_crc=payload.precio_venta_crc,
        costo_estandar_crc=payload.costo_estandar_crc
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod

@router.put("/{producto_id}", response_model=ProductoOut)
def update_producto(producto_id: int, payload: ProductoUpdate, db: Session = Depends(get_db)):
    prod = db.get(models.Producto, producto_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    data = payload.dict(exclude_unset=True)
    tipo_dest = data.get("tipo", prod.tipo)
    costo_dest = data.get("costo_estandar_crc", prod.costo_estandar_crc)
    _validate_mp(tipo_dest, costo_dest)

    for f, v in data.items():
        setattr(prod, f, v)

    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod
