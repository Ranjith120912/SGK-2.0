
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ConversionCard } from "@/components/conversion-card";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-body bg-background selection:bg-accent/30">
      <Navbar />
      
      <main className="flex-grow flex flex-col items-center justify-center pt-24 pb-12 overflow-hidden relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="w-full max-w-7xl mx-auto px-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <header className="text-center mb-8 max-w-2xl px-4">
            <h1 className="text-4xl sm:text-5xl font-headline font-bold text-primary mb-4 leading-tight">
              Reliable Density Conversion
            </h1>
            <p className="text-lg text-muted-foreground font-body leading-relaxed">
              Instantly calculate volume based on weight with the fixed conversion rate of <span className="text-primary font-semibold">1 kg = 0.97 Litre</span>.
            </p>
          </header>

          <ConversionCard />

          <section className="mt-20 max-w-3xl px-4 text-center">
            <h2 className="text-2xl font-headline font-semibold text-primary mb-6">Why Use LitreLink?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <h3 className="font-bold text-primary">Precision</h3>
                <p className="text-sm text-muted-foreground">Engineered for accuracy with up to 4 decimal points of precision.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-primary">Real-time</h3>
                <p className="text-sm text-muted-foreground">Results update as you type, providing an intuitive experience.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-primary">Minimalist</h3>
                <p className="text-sm text-muted-foreground">A clean, focused interface designed to eliminate distractions.</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
