import React, { useState, useEffect } from "react";
import { 
  Heart, X, Sparkles, Wand2, RefreshCw, Star, Trash2, Edit3, 
  Copy, Save, Download, Upload, Sliders, Volume2, Plus, Info 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BehaviorProfile, ALL_TRAITS, DEFAULT_SLIDERS, PRESET_PROFILES, 
  DEVELOPER_DEFAULT_PROFILE, buildSystemInstruction 
} from "../utils/systemInstructionBuilder";

interface BehaviorStudioProps {
  onClose: () => void;
  onOpenVoiceStudio: () => void;
  activeProfile: BehaviorProfile;
  onProfileChange: (profile: BehaviorProfile) => void;
}

export default function BehaviorStudio({ 
  onClose, 
  onOpenVoiceStudio,
  activeProfile, 
  onProfileChange 
}: BehaviorStudioProps) {
  const [profiles, setProfiles] = useState<BehaviorProfile[]>(() => {
    const saved = localStorage.getItem("jayuki_behavior_profiles");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse behavior profiles", e);
      }
    }
    return [...PRESET_PROFILES];
  });

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState("");
  const [showImportError, setShowImportError] = useState<string | null>(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);

  // Save profiles to local storage whenever they change
  useEffect(() => {
    localStorage.setItem("jayuki_behavior_profiles", JSON.stringify(profiles));
  }, [profiles]);

  // Handle Profile Selection
  const selectProfile = (profile: BehaviorProfile) => {
    onProfileChange(profile);
    localStorage.setItem("jayuki_active_behavior_profile", JSON.stringify(profile));
  };

  // Toggle Trait Selection
  const toggleTrait = (trait: string) => {
    let updatedTraits = [...activeProfile.selectedTraits];
    if (updatedTraits.includes(trait)) {
      // Keep at least one trait
      if (updatedTraits.length > 1) {
        updatedTraits = updatedTraits.filter(t => t !== trait);
      }
    } else {
      updatedTraits.push(trait);
    }

    const updatedProfile = { ...activeProfile, selectedTraits: updatedTraits };
    saveProfileChanges(updatedProfile);
  };

  // Handle Slider Changes
  const handleSliderChange = (name: string, value: number) => {
    const updatedProfile = {
      ...activeProfile,
      sliders: {
        ...activeProfile.sliders,
        [name]: value
      }
    };
    saveProfileChanges(updatedProfile);
  };

  // Save active profile changes to the profiles list
  const saveProfileChanges = (updatedProfile: BehaviorProfile) => {
    onProfileChange(updatedProfile);
    localStorage.setItem("jayuki_active_behavior_profile", JSON.stringify(updatedProfile));

    // Also update in profiles list if it's a custom profile (not a preset, or we allow saving presets as custom)
    setProfiles(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
  };

  // Save/Create Current as a New Profile
  const handleCreateNewProfile = () => {
    const newId = crypto.randomUUID();
    const newProfile: BehaviorProfile = {
      ...activeProfile,
      id: newId,
      name: `Custom Profile ${profiles.length - PRESET_PROFILES.length + 1}`,
      isFavorite: false
    };
    setProfiles(prev => [...prev, newProfile]);
    selectProfile(newProfile);
    setEditingProfileId(newId);
    setEditNameText(newProfile.name);
  };

  // Rename Profile
  const handleStartRename = (profile: BehaviorProfile) => {
    setEditingProfileId(profile.id);
    setEditNameText(profile.name);
  };

  const handleSaveRename = (id: string) => {
    if (!editNameText.trim()) return;
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, name: editNameText.trim() } : p));
    if (activeProfile.id === id) {
      const updated = { ...activeProfile, name: editNameText.trim() };
      onProfileChange(updated);
      localStorage.setItem("jayuki_active_behavior_profile", JSON.stringify(updated));
    }
    setEditingProfileId(null);
  };

  // Duplicate Profile
  const handleDuplicateProfile = (profile: BehaviorProfile) => {
    const newId = crypto.randomUUID();
    const duplicated: BehaviorProfile = {
      ...profile,
      id: newId,
      name: `${profile.name} (Copy)`,
      isFavorite: false
    };
    setProfiles(prev => [...prev, duplicated]);
    selectProfile(duplicated);
  };

  // Delete Profile
  const handleDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't allow deleting developer default
    if (id === "developer-default") return;

    if (confirm("Are you sure you want to delete this profile?")) {
      const remaining = profiles.filter(p => p.id !== id);
      setProfiles(remaining);
      
      if (activeProfile.id === id) {
        // Fallback to Developer default
        selectProfile(DEVELOPER_DEFAULT_PROFILE);
      }
    }
  };

  // Favorite / Unfavorite Profile
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
    if (activeProfile.id === id) {
      const updated = { ...activeProfile, isFavorite: !activeProfile.isFavorite };
      onProfileChange(updated);
      localStorage.setItem("jayuki_active_behavior_profile", JSON.stringify(updated));
    }
  };

  // Random Personality
  const triggerRandomPersonality = () => {
    // Pick 2-4 random traits
    const shuffledTraits = [...ALL_TRAITS].sort(() => 0.5 - Math.random());
    const randomTraitsCount = Math.floor(Math.random() * 3) + 2; // 2 to 4
    const selectedTraits = shuffledTraits.slice(0, randomTraitsCount);

    // Randomize sliders
    const sliders: Record<string, number> = {};
    Object.keys(DEFAULT_SLIDERS).forEach(key => {
      if (key === "Speaking Speed") {
        sliders[key] = parseFloat((Math.random() * (1.5 - 0.7) + 0.7).toFixed(1));
      } else {
        sliders[key] = Math.floor(Math.random() * 101);
      }
    });

    const updatedProfile: BehaviorProfile = {
      ...activeProfile,
      name: "🎲 Random Persona",
      selectedTraits,
      sliders
    };

    saveProfileChanges(updatedProfile);
  };

  // Reset to Default
  const triggerResetToDefault = () => {
    if (confirm("Reset current profile settings to Aman's original defaults?")) {
      selectProfile(DEVELOPER_DEFAULT_PROFILE);
    }
  };

  // Export Settings
  const handleExportSettings = () => {
    const dataStr = JSON.stringify(activeProfile, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jayuki_personality_profile_${activeProfile.name.toLowerCase().replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Settings
  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === "object" && parsed.selectedTraits && parsed.sliders) {
          const importedProfile: BehaviorProfile = {
            id: crypto.randomUUID(),
            name: parsed.name ? `Imported: ${parsed.name}` : "Imported Profile",
            isFavorite: false,
            selectedTraits: parsed.selectedTraits,
            sliders: parsed.sliders,
            selectedVoice: parsed.selectedVoice || "Kore",
            voiceSettings: parsed.voiceSettings || { ...DEVELOPER_DEFAULT_PROFILE.voiceSettings }
          };
          setProfiles(prev => [...prev, importedProfile]);
          selectProfile(importedProfile);
          setShowImportSuccess(true);
          setShowImportError(null);
          setTimeout(() => setShowImportSuccess(false), 3000);
        } else {
          setShowImportError("Invalid profile format. Make sure it contains selectedTraits and sliders.");
        }
      } catch (err) {
        setShowImportError("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-4xl bg-[#02090d]/90 backdrop-blur-3xl border border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden font-sans text-white h-[90vh] flex flex-col pointer-events-auto border-double border-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-amber-500/10 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30">
            <Sparkles className="text-amber-400 w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-amber-400 tracking-wider">🎭 BEHAVIOR STUDIO</h2>
            <p className="text-[11px] text-amber-500/60 font-mono tracking-widest uppercase">Elite Personality Architect • Creator: Aman</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors border border-white/10"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
        {/* Profile Management Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <Star size={12} /> Active Profiles
            </h3>
            <button
              onClick={handleCreateNewProfile}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold transition-all"
            >
              <Plus size={14} /> New Custom
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {profiles.map((prof) => {
              const isActive = activeProfile.id === prof.id;
              const isEditing = editingProfileId === prof.id;

              return (
                <div
                  key={prof.id}
                  onClick={() => !isEditing && selectProfile(prof)}
                  className={`group relative flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isActive 
                      ? "bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
                      : "bg-white/5 border-white/10 hover:border-amber-500/30"
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editNameText}
                        onChange={(e) => setEditNameText(e.target.value)}
                        onBlur={() => handleSaveRename(prof.id)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveRename(prof.id)}
                        className="bg-black/40 border border-amber-500/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold text-sm text-white/90 truncate flex-1 pr-4">
                        {prof.name}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleFavorite(prof.id, e)}
                        className={`p-1 rounded hover:bg-white/10 transition-colors ${
                          prof.isFavorite ? "text-amber-400" : "text-white/30 hover:text-white/70"
                        }`}
                      >
                        <Star size={13} fill={prof.isFavorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-white/40 font-mono">
                      {prof.selectedTraits.length} traits • {prof.selectedVoice}
                    </span>

                    {/* Actions on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartRename(prof); }}
                        className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors"
                        title="Rename Profile"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicateProfile(prof); }}
                        className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors"
                        title="Duplicate Profile"
                      >
                        <Copy size={11} />
                      </button>
                      {prof.id !== "developer-default" && (
                        <button
                          onClick={(e) => handleDeleteProfile(prof.id, e)}
                          className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                          title="Delete Profile"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Personality Traits Grid */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="text-amber-400 w-4 h-4" />
            <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest">
              Personality Traits (Select Unlimited Combinations)
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto p-1 bg-black/20 rounded-xl border border-white/5">
            {ALL_TRAITS.map((trait) => {
              const isSelected = activeProfile.selectedTraits.includes(trait);
              return (
                <button
                  key={trait}
                  onClick={() => toggleTrait(trait)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                    isSelected
                      ? "bg-amber-500/20 border-amber-400/80 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                      : "bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {trait}
                </button>
              );
            })}
          </div>
        </div>

        {/* Personality Sliders Grid */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="text-amber-400 w-4 h-4 animate-spin-slow" />
            <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest">
              Behavioral Intensity Sliders
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {Object.entries(activeProfile.sliders).map(([key, value]) => {
              const isSpeed = key === "Speaking Speed";
              const min = isSpeed ? 0.5 : 0;
              const max = isSpeed ? 2.0 : 100;
              const step = isSpeed ? 0.1 : 1;

              return (
                <div key={key} className="space-y-1.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[11px]">{key}</span>
                    <span className="text-amber-400 font-bold font-mono">
                      {isSpeed ? `${value.toFixed(1)}x` : `${value}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer System Control Panel */}
      <div className="mt-6 border-t border-amber-500/10 pt-4 flex flex-col gap-4 shrink-0 bg-black/10">
        {/* Action Controls Row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={triggerRandomPersonality}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-amber-400 text-xs font-bold border border-white/10 transition-all"
            title="Generate a completely random wild personality"
          >
            <RefreshCw size={14} />
            <span>Random Persona</span>
          </button>

          <button
            onClick={triggerResetToDefault}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 text-xs font-bold border border-white/10 transition-all"
            title="Reset active profile to original developer settings"
          >
            <Wand2 size={14} />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleExportSettings}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 text-xs font-bold border border-white/10 transition-all"
            title="Download active settings profile as JSON"
          >
            <Download size={14} />
            <span>Export Profile</span>
          </button>

          <label className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 text-xs font-bold border border-white/10 transition-all cursor-pointer">
            <Upload size={14} />
            <span>Import Profile</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportSettings}
              className="hidden"
            />
          </label>
        </div>

        {/* Bottom Status & Main Voice Trigger */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-amber-500/5 pt-3">
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Info size={14} className="text-amber-500" />
            <span>Active: <strong className="text-white/80">{activeProfile.name}</strong></span>
            {showImportSuccess && <span className="text-green-400 ml-2 animate-pulse">✓ Imported successfully!</span>}
            {showImportError && <span className="text-red-400 ml-2">❌ {showImportError}</span>}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenVoiceStudio}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-amber-500/30 rounded-xl font-bold text-amber-400 text-sm tracking-wide"
            >
              <Volume2 size={16} />
              <span>🎙 VOICE STUDIO</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-all text-sm tracking-wider shadow-lg shadow-amber-500/10"
            >
              <Save size={16} />
              <span>APPLY BEHAVIOR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
