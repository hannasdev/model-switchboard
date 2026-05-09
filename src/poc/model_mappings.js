export const TARGET_PROFILE_MAP = {
  "openai-codex": {
    "openai-quick": "codex-fast",
    "openai-balanced": "codex-balanced",
    "openai-coder": "codex-best-coder"
  },
  "anthropic-claude": {
    "anthropic-quick": "claude-fast",
    "anthropic-balanced": "claude-balanced",
    "anthropic-coder": "claude-best-coder"
  },
  "google-gemini": {
    "gemini-quick": "gemini-fast",
    "gemini-balanced": "gemini-balanced",
    "gemini-coder": "gemini-best-coder"
  }
};

export const PROFILE_MODEL_MAP = {
  "openai-codex": {
    "codex-fast": "gpt-5.4-mini",
    "codex-balanced": "gpt-5.4",
    "codex-best-coder": "gpt-5.5"
  },
  "anthropic-claude": {
    "claude-fast": "claude-haiku-4-5-20251001",
    "claude-balanced": "claude-sonnet-4-6",
    "claude-best-coder": "claude-sonnet-4-6"
  },
  "google-gemini": {
    "gemini-fast": "gemini-2.5-flash",
    "gemini-balanced": "gemini-2.5-flash",
    "gemini-best-coder": "gemini-2.5-pro"
  }
};

export function getTargetProfileMap(vendor) {
  return TARGET_PROFILE_MAP[vendor] || {};
}

export function getProfileModelMap(vendor) {
  return PROFILE_MODEL_MAP[vendor] || {};
}

export function validateMappings({ vendor, targets }) {
  const targetToProfile = getTargetProfileMap(vendor);
  const profileToModel = getProfileModelMap(vendor);
  const errors = [];

  for (const target of targets) {
    const profile = targetToProfile[target.id];
    if (!profile) {
      errors.push({ type: "missing_target_profile", targetId: target.id });
      continue;
    }
    const model = profileToModel[profile];
    if (!model) {
      errors.push({ type: "missing_profile_model", targetId: target.id, profile });
    }
  }

  return {
    vendor,
    targetCount: targets.length,
    mappedTargetCount: Object.keys(targetToProfile).length,
    profileCount: Object.keys(profileToModel).length,
    ok: errors.length === 0,
    errors,
    targetToProfile,
    profileToModel
  };
}
