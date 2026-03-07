import polars as pl
import random
import io
from datetime import datetime, timedelta

def generar_datasets_en_memoria(filas: int):
    n = min(filas, 3000)
    localidades = ["GENERAL PICO", "REALICO", "QUETREQUEN", "CASTEX"]
    
    # Datos desorganizados (Simulación de entrada humana)
    data_sucia = []
    for _ in range(n):
        data_sucia.append({
            "FECHA": f"{random.randint(1,28)}/{random.randint(1,12)}/2024",
            "  Localidad  ": random.choice(localidades),
            "PRODUCTO": random.choice(["nafta super", "GASOIL", "Súper"]),
            "PRECIO": random.choice([random.uniform(700, 1100), "S/D", 0])
        })
    
    df_sucio = pl.DataFrame(data_sucia)
    
    # 1. CSV Sucio en Memoria
    csv_buffer = io.BytesIO()
    df_sucio.write_csv(csv_buffer)
    csv_buffer.seek(0)

    # 2. Limpieza y Excel en Memoria
    df_limpio = (
        df_sucio.lazy()
        .rename(lambda col: col.lower().strip())
        .with_columns([
            pl.col("precio").cast(pl.Float64, strict=False).fill_null(0.0),
            pl.col("producto").str.to_uppercase(),
            pl.col("fecha").str.to_date(format="%d/%m/%Y", strict=False).fill_null(datetime.now())
        ])
        .collect()
    )
    
    excel_buffer = io.BytesIO()
    df_limpio.write_excel(
        excel_buffer,
        table_style="Table Style Medium 9",
        column_formats={"precio": "$ #,##0.00"},
        autofit=True
    )
    excel_buffer.seek(0)

    return csv_buffer, excel_buffer, df_limpio.head(5).to_dicts()