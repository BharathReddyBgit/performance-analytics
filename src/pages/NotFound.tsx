import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
    >
      <p className="font-mono text-6xl font-semibold tracking-tight">404</p>
      <p className="mt-3 text-sm text-muted-foreground">This page could not be found.</p>
      <Button asChild variant="outline" className="mt-6">
        <a href="/"><ArrowLeft className="size-4" /> Back to home</a>
      </Button>
    </motion.div>
  );
}
