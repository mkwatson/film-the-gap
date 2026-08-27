namespace WebMCPPolicy

/-- The public evidence outcome used by the page's capability frontier. -/
inductive EvidenceOutcome where
  | noRequirements
  | unresolved
  | ready
  | incompatible
  deriving BEq, DecidableEq, Repr

/--
The deliberately small public abstraction that controls whether the reversible
hold tool may exist. Empirical truth and private buyer context are outside it.
-/
structure CapabilityState where
  showLive : Bool
  evidence : EvidenceOutcome
  hasHold : Bool
  deriving BEq, Repr

/-- The policy compiled into the browser-visible hold capability table. -/
def reserveToolAvailable (state : CapabilityState) : Bool :=
  state.showLive && decide (state.evidence = .ready) && !state.hasHold

/--
If the policy exposes the hold tool, the lot is live, public evidence is ready,
and no hold already exists.
-/
theorem reserveToolAvailable_sound (state : CapabilityState)
    (allowed : reserveToolAvailable state = true) :
    state.showLive = true ∧ state.evidence = .ready ∧ state.hasHold = false := by
  cases state with
  | mk showLive evidence hasHold =>
      cases showLive <;> cases evidence <;> cases hasHold <;>
        simp [reserveToolAvailable] at allowed ⊢

/-- Public fields needed by the seller to establish product evidence. -/
structure SellerEnvelope where
  minLengthCm : Nat
  maxLengthCm : Nat
  requiresVisibleEdges : Bool
  forbidsPriorBaseRepair : Bool
  deriving BEq, Repr

/-- A buyer mandate includes a secret that must not enter the seller envelope. -/
structure BuyerMandate where
  minLengthCm : Nat
  maxLengthCm : Nat
  requiresVisibleEdges : Bool
  forbidsPriorBaseRepair : Bool
  privateCeiling : Nat
  deriving BEq, Repr

def sellerEnvelope (mandate : BuyerMandate) : SellerEnvelope := {
  minLengthCm := mandate.minLengthCm
  maxLengthCm := mandate.maxLengthCm
  requiresVisibleEdges := mandate.requiresVisibleEdges
  forbidsPriorBaseRepair := mandate.forbidsPriorBaseRepair
}

/-- Changing only the private ceiling cannot change the modeled seller payload. -/
theorem sellerEnvelope_privateCeiling_noninterference
    (mandate : BuyerMandate) (firstCeiling secondCeiling : Nat) :
    sellerEnvelope { mandate with privateCeiling := firstCeiling } =
      sellerEnvelope { mandate with privateCeiling := secondCeiling } := by
  rfl

/-- Values checked by the authoritative room when a hold command arrives. -/
structure HoldAttempt where
  expectedRevision : Nat
  currentRevision : Nat
  expectedQuote : Nat
  currentQuote : Nat
  deriving BEq, Repr

def acceptHold (state : CapabilityState) (attempt : HoldAttempt) : Bool :=
  reserveToolAvailable state &&
    decide (attempt.expectedRevision = attempt.currentRevision) &&
    decide (attempt.expectedQuote = attempt.currentQuote)

/-- Every accepted modeled hold is eligible, fresh, and bound to the exact quote. -/
theorem acceptedHold_sound (state : CapabilityState) (attempt : HoldAttempt)
    (accepted : acceptHold state attempt = true) :
    reserveToolAvailable state = true ∧
      attempt.expectedRevision = attempt.currentRevision ∧
      attempt.expectedQuote = attempt.currentQuote := by
  simp [acceptHold] at accepted
  exact ⟨accepted.1.1, accepted.1.2, accepted.2⟩

/-- A stale revision can never be accepted by the modeled hold policy. -/
theorem staleRevision_refused (state : CapabilityState) (attempt : HoldAttempt)
    (stale : attempt.expectedRevision ≠ attempt.currentRevision) :
    acceptHold state attempt = false := by
  simp [acceptHold, stale]

#print axioms reserveToolAvailable_sound
#print axioms sellerEnvelope_privateCeiling_noninterference
#print axioms acceptedHold_sound
#print axioms staleRevision_refused

end WebMCPPolicy
