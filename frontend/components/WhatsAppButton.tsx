import { getSettings, whatsappLink } from "@/lib/settings";

export async function WhatsAppButton() {
  const s = await getSettings();
  return (
    <a
      href={whatsappLink("Hi SPORTIQ, I have a question.", s)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 bg-[#25D366] px-4 text-sm font-semibold text-white shadow-lg transition hover:brightness-95 md:bottom-6 md:right-6"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M4 3h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-5 4V4a1 1 0 0 1 1-1z" />
      </svg>
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
