from fastapi import APIRouter, HTTPException
import sqlite3
import os

router = APIRouter()
DB_PATH = "data/surtidores.db"

@router.get("/comparativa-norte-pampeano")
async def comparativa_ciudades(producto: str = "NAFTA SUPER"):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="DB no encontrada")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
    WITH DatosLimpios AS (
        -- Primero normalizamos y agrupamos por fecha para evitar duplicados del mismo día
        SELECT 
            fecha,
            TRIM(UPPER(localidad)) as localidad_norm,
            AVG(precio) as precio_diario
        FROM precios_historicos
        WHERE localidad_norm IN ('REALICO', 'GENERAL PICO') 
        AND UPPER(producto) LIKE UPPER(?)
        GROUP BY fecha, localidad_norm
    ),
    Calculos AS (
        -- Ahora calculamos el LAG sobre datos ya promediados por día
        SELECT 
            fecha,
            localidad_norm as localidad,
            ROUND(precio_diario, 2) as precio,
            LAG(precio_diario) OVER (
                PARTITION BY localidad_norm 
                ORDER BY fecha ASC -- El LAG siempre debe mirar hacia atrás en el tiempo
            ) as precio_anterior
        FROM DatosLimpios
    )
    SELECT 
        fecha,
        localidad,
        precio,
        -- Si no hay precio anterior (primer registro), el aumento es 0
        COALESCE(ROUND(precio - precio_anterior, 2), 0) as aumento_nominal,
        COALESCE(ROUND(((precio - precio_anterior) / precio_anterior) * 100, 2), 0) as aumento_porcentual
    FROM Calculos
    ORDER BY fecha DESC, localidad ASC -- Presentamos lo más nuevo arriba
    """
    
    try:
        cursor.execute(query, (f"%{producto}%",))
        rows = cursor.fetchall()
        
        metricas = [dict(row) for row in rows]
        
        return {
            "query_info": {
                "producto_buscado": producto,
                "total_registros": len(metricas),
                "localidades_incluidas": ["REALICO", "GENERAL PICO"]
            },
            "metricas": metricas
        }
    finally:
        conn.close()