import time
import logging
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from routes import analytics, estaciones_de_servicio, industrial, email
from config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger("INDUSTRIAL_SERVER")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Portfolio Industrial La Pampa", version="1.5.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_performance(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000
    
    color = "🟢" if duration < 200 else "🟡" if duration < 500 else "🔴"
    logger.info(f"{color} {request.method} {request.url.path} - {duration:.2f}ms")
    return response

app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Inteligencia de Datos"])
app.include_router(estaciones_de_servicio.router, prefix="/api/v1/surtidores", tags=["Real-Time"])
app.include_router(industrial.router, prefix="/api/v1/industrial", tags=["Simulación Industrial"])
app.include_router(email.router, prefix="/api/v1/comms", tags=["Comunicaciones"])

@app.get("/health")
async def health_check():
    import os
    return {
        "status": "online",
        "database": "ready" if os.path.exists(settings.db_path) else "missing",
        "ia_service": "active" if settings.hf_token else "disabled"
    }

if __name__ == "__main__":
    uvicorn.run(
        "app:app", 
        host="0.0.0.0", 
        port=8081, 
        reload=True,
        log_level="info"
    )