import { uid, type PlanItem } from "./domain";

// Example household times, not an age-specific care schedule. Each draft owns
// its IDs and day arrays so editing it cannot change another household's draft.
export function createStarterRoutine(): PlanItem[] {
  const activities: Pick<PlanItem, "type" | "time">[] = [
    { type: "outside", time: "07:00" },
    { type: "meal", time: "07:30" },
    { type: "play", time: "08:00" },
    { type: "sleep", time: "09:00" },
    { type: "outside", time: "12:00" },
    { type: "meal", time: "12:30" },
    { type: "play", time: "16:00" },
    { type: "meal", time: "18:00" },
    { type: "outside", time: "20:30" },
    { type: "sleep", time: "21:00" },
  ];
  return activities.map((activity) => ({
    ...activity,
    id: uid(),
    days: [0, 1, 2, 3, 4, 5, 6],
  }));
}
