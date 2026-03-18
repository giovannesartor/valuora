"""
Quanto Vale — Benchmark Updater
Scheduled task module for IBGE benchmark updates.
Re-exports from app.tasks.__init__.
"""

from app.tasks import (
    update_all_benchmarks,
    update_single_benchmark,
    setup_scheduler,
    cleanup_trash,
    send_abandoned_analysis_reminders,
)

__all__ = [
    "update_all_benchmarks",
    "update_single_benchmark",
    "setup_scheduler",
    "cleanup_trash",
    "send_abandoned_analysis_reminders",
]
