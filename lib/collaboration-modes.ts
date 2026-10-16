// How each collaboration mode is named in the UI (same wording as the
// Create Story picker), and the participant cap each one implies.
export const MODE_LABELS: Record<string, string> = {
  solo: "Write alone",
  duo: "Duo",
  anonymous_duo: "Anonymous Duo",
  multiple: "Multiple Writers",
  public: "Public Collaboration",
  public_anonymous: "Public Anonymous",
  private: "Private Collaboration",
  private_anonymous: "Private Anonymous",
};

// Total writers INCLUDING the owner, or null for no cap. Duo modes are
// always exactly two; every other mode uses the project's own
// maxParticipants.
export function participantCap(mode: string, maxParticipants: number | null): number | null {
  return mode === "duo" || mode === "anonymous_duo" ? 2 : maxParticipants;
}
