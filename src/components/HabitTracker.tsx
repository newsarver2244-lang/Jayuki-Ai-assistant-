import React, { useState, useEffect } from "react";
import { Check, Plus, Trash2, Edit2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Habit {
  id: string;
  name: string;
  completedDays: string[]; // ISO dates
}

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem("jayuki_habits");
    return saved ? JSON.parse(saved) : [
      { id: "1", name: "Drink Water", completedDays: [] },
      { id: "2", name: "Meditation", completedDays: [] }
    ];
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    localStorage.setItem("jayuki_habits", JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    const handleRemoteUpdate = (e: any) => {
      const { habitTitle, completed } = e.detail;
      setHabits(prev => prev.map(h => {
        if (h.name.toLowerCase().includes(habitTitle.toLowerCase())) {
          const isCurrentlyCompleted = h.completedDays.includes(today);
          if (completed && !isCurrentlyCompleted) {
            return { ...h, completedDays: [...h.completedDays, today] };
          } else if (!completed && isCurrentlyCompleted) {
            return { ...h, completedDays: h.completedDays.filter(d => d !== today) };
          }
        }
        return h;
      }));
    };
    window.addEventListener('jayuki-update-habit', handleRemoteUpdate);
    
    const handleRemoteAdd = (e: any) => {
      const { habitTitle } = e.detail;
      setHabits(prev => {
        // Prevent duplicates
        if (prev.some(h => h.name.toLowerCase() === habitTitle.toLowerCase())) return prev;
        return [...prev, { id: crypto.randomUUID(), name: habitTitle, completedDays: [] }];
      });
    };
    window.addEventListener('jayuki-add-habit', handleRemoteAdd);

    return () => {
      window.removeEventListener('jayuki-update-habit', handleRemoteUpdate);
      window.removeEventListener('jayuki-add-habit', handleRemoteAdd);
    };
  }, [today]);

  const toggleHabit = (id: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const completed = h.completedDays.includes(today)
          ? h.completedDays.filter(d => d !== today)
          : [...h.completedDays, today];
        return { ...h, completedDays: completed };
      }
      return h;
    }));
  };

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    setHabits([...habits, { id: crypto.randomUUID(), name: newHabitName, completedDays: [] }]);
    setNewHabitName("");
    setIsAdding(false);
  };

  const deleteHabit = (id: string) => {
    setHabits(habits.filter(h => h.id !== id));
  };

  return (
    <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-amber-400">Habit Tracker</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="p-2 bg-amber-500/20 hover:bg-amber-500/40 rounded-full transition-colors text-amber-400"
        >
          <Plus size={20} />
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        <div className="space-y-4">
          {habits.map((habit) => (
            <motion.div 
              key={habit.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl group hover:border-amber-500/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleHabit(habit.id)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    habit.completedDays.includes(today)
                      ? "bg-amber-500 border-amber-500 text-black"
                      : "border-amber-500/30 text-transparent"
                  }`}
                >
                  <Check size={16} />
                </button>
                <div className="flex flex-col">
                  <span className={`text-lg transition-all ${habit.completedDays.includes(today) ? "text-white/40 line-through" : "text-white"}`}>
                    {habit.name}
                  </span>
                  <span className="text-xs text-amber-500/60">
                    Streak: {habit.completedDays.length} days
                  </span>
                </div>
              </div>
              <button 
                onClick={() => deleteHabit(habit.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-red-400 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6"
          >
            <form onSubmit={addHabit} className="relative">
              <input
                autoFocus
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                placeholder="New Habit Name..."
                className="w-full bg-white/5 border border-amber-500/30 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-amber-500 transition-all pr-12"
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-amber-500 text-black rounded-lg"
              >
                <Check size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
