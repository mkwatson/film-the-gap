import CapabilityPolicy

open WebMCPPolicy

namespace WebMCPPolicyReceipt

def boolJson (value : Bool) : String :=
  if value then "true" else "false"

def evidenceLabel : EvidenceOutcome → String
  | .noRequirements => "no-requirements"
  | .unresolved => "unresolved"
  | .ready => "ready"
  | .incompatible => "incompatible"

def evidenceOutcomes : List EvidenceOutcome :=
  [.noRequirements, .unresolved, .ready, .incompatible]

def booleans : List Bool := [false, true]

def states : List CapabilityState :=
  booleans.flatMap fun showLive =>
    evidenceOutcomes.flatMap fun evidence =>
      booleans.map fun hasHold => { showLive, evidence, hasHold }

def stateJson (state : CapabilityState) : String :=
  "{" ++
    "\"showLive\":" ++ boolJson state.showLive ++ "," ++
    "\"evidenceOutcome\":\"" ++ evidenceLabel state.evidence ++ "\"," ++
    "\"hasHold\":" ++ boolJson state.hasHold ++ "," ++
    "\"reserveToolAvailable\":" ++ boolJson (reserveToolAvailable state) ++
    "}"

def receiptJson : String :=
  "{" ++
    "\"schemaVersion\":1," ++
    "\"policy\":\"reserve_current_lot\"," ++
    "\"leanToolchain\":\"leanprover/lean4:v4.33.1\"," ++
    "\"theorems\":[" ++
      "\"WebMCPPolicy.reserveToolAvailable_sound\"," ++
      "\"WebMCPPolicy.sellerEnvelope_privateCeiling_noninterference\"," ++
      "\"WebMCPPolicy.acceptedHold_sound\"," ++
      "\"WebMCPPolicy.staleRevision_refused\"" ++
    "]," ++
    "\"cases\":[" ++ String.intercalate "," (states.map stateJson) ++ "]" ++
  "}"

end WebMCPPolicyReceipt

def main : IO Unit :=
  IO.println WebMCPPolicyReceipt.receiptJson
