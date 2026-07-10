from app.correlation.policies.base import DiagnosisPolicy
from app.correlation.policies.output_reliability import OutputReliabilityPolicy
from app.correlation.policies.platform_reliability import PlatformReliabilityPolicy
from app.correlation.policies.tool_governance import ToolGovernancePolicy

POLICY_BY_FAMILY: dict[str, DiagnosisPolicy] = {
    OutputReliabilityPolicy.diagnosis_family: OutputReliabilityPolicy(),
    ToolGovernancePolicy.diagnosis_family: ToolGovernancePolicy(),
    PlatformReliabilityPolicy.diagnosis_family: PlatformReliabilityPolicy(),
}
