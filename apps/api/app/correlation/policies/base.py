"""Policy interface for diagnosis-family risk assessment."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.correlation.models import CorrelationCandidate, RiskAssessmentResult
from app.db.models import SignalCluster


class DiagnosisPolicy(ABC):
    diagnosis_family: str
    diagnosis_label: str
    risk_category: str

    @abstractmethod
    def evaluate_cluster(
        self,
        cluster: SignalCluster,
        candidates: list[CorrelationCandidate],
        *,
        system_profile: dict[str, Any] | None = None,
    ) -> RiskAssessmentResult:
        raise NotImplementedError
