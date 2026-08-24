export default function HostReadySection() {
  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="mx-auto grid max-w-editorial gap-12 px-6 md:grid-cols-2 md:items-center">
        <div>
          <p className="mb-4 font-body text-xs font-bold uppercase tracking-[0.2em] text-olive">
            HostReady&trade;
          </p>
          <h2 className="font-display text-4xl leading-tight text-forest md:text-5xl">
            Know when you&rsquo;re actually ready.
          </h2>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            HostReady&trade; isn&rsquo;t a simple checklist percentage. It
            weighs what matters most, what&rsquo;s already handled, how much
            time is left, and whether anything critical is still unresolved.
          </p>
          <p className="mt-6 font-display text-2xl italic text-olive">
            You do not need 100%. You need enough of what matters handled.
          </p>
          <p className="mt-6 font-body text-base leading-relaxed text-forest/70">
            And HostReady&trade; doesn&rsquo;t just score you quietly in the
            background — it tells you before something becomes urgent, with
            gentle nudges as guests get closer and a clear alert if something
            time-sensitive still needs attention.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="relative flex h-64 w-64 items-center justify-center rounded-full border-[14px] border-sage/40 shadow-soft">
            <div
              className="absolute inset-0 rounded-full border-[14px] border-forest"
              style={{
                clipPath:
                  "polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 15% 100%)",
              }}
              aria-hidden
            />
            <div className="text-center">
              <p className="font-display text-5xl text-forest">92%</p>
              <p className="mt-1 font-body text-xs uppercase tracking-wide text-forest/60">
                HostReady&trade;
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-editorial px-6">
        <p className="font-display text-xl text-forest/80">
          The important things are handled. Go enjoy your people.
        </p>
      </div>
    </section>
  );
}
