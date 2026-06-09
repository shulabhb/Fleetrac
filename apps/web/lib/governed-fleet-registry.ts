/**
 * Canonical governed fleet — the 10 simulator systems Fleetrac governs.
 * Static registry; operational counts come from the governance API.
 */

export const GOVERNED_FLEET_SYSTEM_COUNT = 10;

export const GOVERNED_FLEET_SYSTEMS_SUB =
  "10 agentic workflows · multi-cloud telemetry";

export type GovernedFleetSystem = {
  systemId: string;
  displayId: string;
  name: string;
  modelCode: string;
  ownerTeam: string;
  platform: "aws" | "azure" | "gcp";
};

export const GOVERNED_FLEET_SYSTEMS: GovernedFleetSystem[] = [
  {
    systemId: "sys-agt-refund-001",
    displayId: "REF-001",
    name: "Refund Approval Agent",
    modelCode: "REF-001",
    ownerTeam: "Model Risk Management",
    platform: "aws"
  },
  {
    systemId: "sys-agt-cs-002",
    displayId: "A12",
    name: "Ticket Routing Agent",
    modelCode: "M49",
    ownerTeam: "Security Operations",
    platform: "azure"
  },
  {
    systemId: "sys-agt-pep-003",
    displayId: "M50",
    name: "PEP Screening",
    modelCode: "M50",
    ownerTeam: "Model Risk Management",
    platform: "gcp"
  },
  {
    systemId: "sys-agt-kyc-004",
    displayId: "KYC-004",
    name: "KYC Document Review",
    modelCode: "M18",
    ownerTeam: "Model Risk Management",
    platform: "aws"
  },
  {
    systemId: "sys-agt-inv-005",
    displayId: "M44",
    name: "Invoice OCR Validation",
    modelCode: "M44",
    ownerTeam: "Platform Reliability",
    platform: "azure"
  },
  {
    systemId: "sys-agt-treasury-001",
    displayId: "M40",
    name: "NII Sensitivity",
    modelCode: "M40",
    ownerTeam: "Model Risk Management",
    platform: "gcp"
  },
  {
    systemId: "sys-agt-rag-007",
    displayId: "RAG-007",
    name: "Internal Knowledge RAG",
    modelCode: "M32",
    ownerTeam: "Platform Reliability",
    platform: "aws"
  },
  {
    systemId: "sys-agt-phish-008",
    displayId: "PHISH-008",
    name: "Phishing Triage",
    modelCode: "M45",
    ownerTeam: "Security Operations",
    platform: "azure"
  },
  {
    systemId: "sys-agt-access-009",
    displayId: "ACCESS-009",
    name: "Access Review",
    modelCode: "ACCESS-009",
    ownerTeam: "Security Operations",
    platform: "aws"
  },
  {
    systemId: "sys-agt-reg-010",
    displayId: "REG-010",
    name: "Regulatory Change Monitor",
    modelCode: "M37",
    ownerTeam: "Model Risk Management",
    platform: "gcp"
  }
];
