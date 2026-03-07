# backend/routes/__init__.py
from .analytics import router as analytics_router
from .estaciones_de_servicio import router as estaciones_router
from .industrial import router as industrial_router
from .email import router as email_router

__all__: list[str] = [
    "analytics_router",
    "estaciones_router",
    "camioneros_router",
    "industrial_router",
    "email_router"
]