import { getSettings } from "@/lib/settings";

export async function AnnouncementTicker() {
  const messages = (await getSettings()).ticker.split("\n").map((m) => m.trim()).filter(Boolean);
  if (messages.length === 0) return null;
  const row = [...messages, ...messages];
  return (
    <div className="overflow-hidden bg-ink text-paper" role="region" aria-label="Announcements">
      <div className="ticker-track flex w-max gap-14 whitespace-nowrap py-2 eyebrow">
        {row.map((m, i) => (
          <span key={i} className="flex items-center gap-14" aria-hidden={i >= messages.length}>
            {m}
            <span className="text-accent">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}
