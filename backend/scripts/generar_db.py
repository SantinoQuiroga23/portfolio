import polars as pl
import httpx
import sqlite3
import os
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DB_PATH = "data/surtidores.db"
URL_ACTUAL = "http://datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/resource/80ac25de-a44a-4445-9215-090cf55cfda5/download/precios-en-surtidor-resolucin-3142016.csv"
URL_HISTORICO = "http://datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/resource/f8dda0d5-2a9f-4d34-b79b-4e63de3995df/download/precios-historicos.csv"
MAX_FILE_SIZE = 1.3 * 1024 * 1024 * 1024 

def extraer_data(temp_file, es_historico=False):
    logger.info(f"Iniciando procesamiento de {temp_file}")
    q = (
        pl.scan_csv(temp_file, encoding="utf8-lossy", infer_schema_length=0, 
                    ignore_errors=True, truncate_ragged_lines=True)
        .rename(lambda col: col.lower().strip())
    )
    
    cols = q.collect_schema().names()
    c_bandera = "empresabandera" if "empresabandera" in cols else "bandera"
    # Buscamos la columna de tiempo (puede variar entre indice_tiempo o fecha_vigencia)
    c_fecha = next((c for c in cols if "fecha" in c or "indice" in c), None)

    select_cols = [
        pl.col(c_bandera).alias("bandera"),
        pl.col("producto"),
        pl.col("precio").cast(pl.Float64, strict=False).fill_null(0.0),
        pl.col("localidad"),
        pl.col("direccion")
    ]

    if es_historico and c_fecha:
        select_cols.append(pl.col(c_fecha).alias("fecha"))

    df = q.filter(pl.col("provincia").str.contains("PAMPA")).select(select_cols).collect(engine="streaming")
    return df

def safe_update():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if not os.path.exists(DB_PATH):
        with open(DB_PATH, 'w') as f: pass

    config = [
        (URL_ACTUAL, "precios_hoy", "temp_hoy.csv", False),
        (URL_HISTORICO, "precios_historicos", "temp_hist.csv", True)
    ]

    try:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        cursor = conn.cursor()

        for url, table, temp, is_hist in config:
            # Lógica de descarga (simplificada para el ejemplo)
            with httpx.Client(timeout=900.0) as client:
                with client.stream("GET", url) as r:
                    with open(temp, "wb") as f:
                        for chunk in r.iter_bytes(chunk_size=1024*1024): f.write(chunk)

            df = extraer_data(temp, es_historico=is_hist)
            
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
            if is_hist:
                cursor.execute(f"CREATE TABLE {table} (bandera TEXT, producto TEXT, precio REAL, localidad TEXT, direccion TEXT, fecha TEXT)")
                cursor.executemany(f"INSERT INTO {table} VALUES (?, ?, ?, ?, ?, ?)", df.iter_rows())
            else:
                cursor.execute(f"CREATE TABLE {table} (bandera TEXT, producto TEXT, precio REAL, localidad TEXT, direccion TEXT)")
                cursor.executemany(f"INSERT INTO {table} VALUES (?, ?, ?, ?, ?)", df.iter_rows())
            
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_loc ON {table} (localidad)")
            if is_hist:
                cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_fecha ON {table} (fecha)")

            if os.path.exists(temp): os.remove(temp)

        conn.commit()
        conn.close()
        logger.info("Base de datos actualizada con éxito.")
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    safe_update()