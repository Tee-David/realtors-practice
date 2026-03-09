import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background relative overflow-hidden px-4">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px] pointer-events-none -z-10" />
      
      <div className="text-center max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-bold uppercase tracking-widest mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          404 Error
        </div>
        
        <h1 className="font-display text-7xl md:text-9xl font-black tracking-tighter text-foreground mb-4 opacity-10">
          404
        </h1>
        
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6 absolute top-1/2 left-1/2 -translate-x-1/2 mt-10 md:mt-16 w-full px-4">
          Route Uncharted
        </h2>
        
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-8 mt-12 px-4 shadow-sm">
          We've searched the grid, but the property coordinates you're looking for don't exist in our current database index. It may have been moved or deleted.
        </p>

        <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all hover:scale-105 shadow-xl shadow-primary/20">
          <ArrowLeft className="w-4 h-4" /> Return to Command Center
        </Link>
      </div>
    </div>
  );
}
