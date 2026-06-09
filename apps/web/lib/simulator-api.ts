/**
 * Simulator control API — re-exports from governance-api for ingest/SSE clients.
 */

export {
  fetchSimulatorStatus,
  postSimulatorReset,
  postSimulatorStart,
  postSimulatorStop,
  postSimulatorPause,
  postScenario,
  postPitch,
  governanceEventsStreamUrl,
  type SimulatorStatusDTO
} from "@/lib/governance-api";
