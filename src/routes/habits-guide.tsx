import { createFileRoute, Link } from "@tanstack/react-router";

const CANONICAL = "https://discipline-flow-33.lovable.app/habits-guide";

export const Route = createFileRoute("/habits-guide")({
  ssr: true,
  head: () => ({
    meta: [
      { title: "Essential Habits to Track for Discipline & Productivity" },
      {
        name: "description",
        content:
          "A practical guide to the daily habits worth tracking — sleep, deep work, exercise, journaling and more — to build discipline and lasting productivity.",
      },
      { property: "og:title", content: "Essential Habits to Track for Discipline & Productivity" },
      {
        property: "og:description",
        content:
          "Which habits should you actually track? A grounded guide to the routines that move discipline, focus and consistency.",
      },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Essential Habits to Track for Discipline & Productivity",
          description:
            "A practical guide to the daily habits worth tracking to build discipline and lasting productivity.",
          mainEntityOfPage: CANONICAL,
        }),
      },
    ],
  }),
  component: HabitsGuide,
});

const HABITS: { name: string; why: string; how: string }[] = [
  {
    name: "Consistent sleep window",
    why: "Sleep is the foundation of focus, mood regulation and willpower. Inconsistent sleep degrades every other habit.",
    how: "Track bedtime and wake time. Aim for the same window 6 days a week, within ±30 minutes.",
  },
  {
    name: "Deep work block",
    why: "Most meaningful output comes from uninterrupted focus on a single hard problem.",
    how: "Track one 60–90 minute distraction-free session per day on your most important task.",
  },
  {
    name: "Daily movement",
    why: "Exercise improves cognition, mood and energy — the inputs that make discipline easier.",
    how: "Track any 20+ minute session: walk, lift, run, yoga. Streak the showing-up, not the intensity.",
  },
  {
    name: "Hydration",
    why: "Mild dehydration silently lowers focus and patience.",
    how: "Track glasses of water or total intake. A daily target beats a vague 'drink more'.",
  },
  {
    name: "Morning routine",
    why: "The first 30 minutes set the tone. A repeatable opener removes decision fatigue.",
    how: "Track a short fixed sequence: light, water, movement, plan the day's top 3 tasks.",
  },
  {
    name: "Journaling or reflection",
    why: "Brief reflection compounds. It surfaces patterns and re-aligns you with what matters.",
    how: "Track a 5-minute end-of-day entry: 1 win, 1 lesson, 1 priority for tomorrow.",
  },
  {
    name: "Reading or learning",
    why: "Slow knowledge accumulation compounds far beyond any single productivity hack.",
    how: "Track 15–30 minutes of focused reading or study, ideally at the same time each day.",
  },
  {
    name: "Screen-time boundary",
    why: "Distraction is the silent tax on every other habit on this list.",
    how: "Track time on the apps that pull you most. The number itself is the intervention.",
  },
];

function HabitsGuide() {
  return (
    <main className="min-h-svh px-4 py-12 md:py-16">
      <article className="max-w-3xl mx-auto">
        <p className="text-sm text-emerald font-medium">DisciplineOS — Guide</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">
          Essential Habits to Track for Discipline &amp; Productivity
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          The point of habit tracking isn't to collect data — it's to make a small set of inputs
          impossible to ignore. The habits below are the ones that move the needle on focus,
          consistency and discipline. Track these first, then add specialised ones as they earn
          their place.
        </p>

        <section className="mt-10 space-y-6">
          {HABITS.map((h) => (
            <div key={h.name} className="glass rounded-2xl p-5">
              <h2 className="font-display text-lg font-semibold">{h.name}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                <strong className="text-foreground">Why it matters. </strong>{h.why}
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                <strong className="text-foreground">How to track it. </strong>{h.how}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-10 glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold">How to start</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Pick three habits from this list — not eight. Track them for 30 days in DisciplineOS,
            review your consistency, and only then add more. Discipline is built by what you do
            repeatedly, not by what you plan.
          </p>
          <div className="mt-4">
            <Link
              to="/auth"
              className="inline-flex items-center rounded-xl bg-emerald text-emerald-foreground px-4 py-2 text-sm font-medium"
            >
              Start tracking in DisciplineOS
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}