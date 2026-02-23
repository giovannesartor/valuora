"""
Quanto Vale — Benchmark Updater
Módulo de tarefa agendada para atualização de benchmarks IBGE.
Reexporta de app.tasks.__init__.
"""

from app.tasks import (
    update_all_benchmarks,
    update_single_benchmark,
    setup_scheduler,
    cleanup_trash,
)

__all__ = [
    "update_all_benchmarks",
    "update_single_benchmark",
    "setup_scheduler",
    "cleanup_trash",
]
