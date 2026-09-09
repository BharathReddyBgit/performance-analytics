import { motion } from "framer-motion";
import { ArrowRight, Activity, Gauge, Table2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: Table2,
    title: "Virtualized data explorer",
    desc: "Sort, search and filter 200k records with a windowed table that renders only visible rows.",
  },
  {
    icon: Activity,
    title: "Worker-side aggregation",
    desc: "The dataset lives in a Web Worker as columnar typed arrays. Charts receive aggregates, never raw rows.",
  },
  {
    icon: Gauge,
    title: "Measured performance",
    desc: "A dedicated monitor reports real query, search and render latencies — p50/p95 from ring buffers.",
  },
  {
    icon: ShieldCheck,
    title: "Production patterns",
    desc: "Memoized pipelines, debounced search, query caching, error boundaries, skeletons and empty states.",
  },
];

const STATS = [
  { value: "200k", label: "rows, in-memory" },
  { value: "O(1)", label: "date-window scans" },
  { value: "<16ms", label: "target frame budget" },
  { value: "100%", label: "typed, zero any" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6">
        <header className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
              P
            </div>
            <span className="text-sm font-semibold tracking-tight">Pulse Analytics</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="/auth">Sign in</a>
          </Button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="secondary" className="mb-5 font-mono text-[11px]">
              Frontend R&D · Performance-Critical Data Visualization
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              An analytics dashboard engineered for{" "}
              <span className="text-primary">large datasets</span>.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Pulse Analytics explores hundreds of thousands of ad-performance records with
              interactive charts, a virtualized explorer, and honest, measurable performance
              telemetry — built to demonstrate production-grade React architecture.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 px-6 text-sm">
                <a href="/auth">
                  Launch dashboard
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-6 text-sm">
                <a href="#architecture">Read the architecture</a>
              </Button>
            </div>
          </motion.div>

          <div className="mt-16 grid grid-cols-2 gap-6 border-t pt-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-mono text-2xl font-semibold tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <section id="architecture" className="mt-20 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Card className="h-full py-0">
                  <CardContent className="flex h-full flex-col gap-2.5 p-5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="size-4" />
                    </div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs leading-6 text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </section>
        </main>

        <footer className="flex h-14 items-center justify-between border-t text-[11px] text-muted-foreground">
          <span>Pulse Analytics — Performance R&D</span>
          <span>React · TypeScript · Web Workers · TanStack</span>
        </footer>
      </div>
    </div>
  );
}
