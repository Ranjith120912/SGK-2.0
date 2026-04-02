
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ConversionCard } from "@/components/conversion-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info, HelpCircle, ShieldCheck, ArrowRightLeft } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-body bg-background selection:bg-accent/30">
      <Navbar />
      
      <main className="flex-grow flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-primary/10 via-background to-background -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-accent/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <div className="w-full max-w-7xl mx-auto px-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <header className="text-center mb-12 max-w-3xl px-4">
            <h1 className="text-5xl sm:text-7xl font-headline font-black text-primary mb-6 leading-[1.1] tracking-tighter">
              The Smart Way to <br/>Measure Volume
            </h1>
            <p className="text-xl text-muted-foreground font-body leading-relaxed max-w-xl mx-auto">
              Convert between weight and volume for any liquid with laboratory precision. Optimized for industrial and commercial use.
            </p>
          </header>

          <ConversionCard />

          <section className="mt-32 w-full max-w-3xl px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-headline font-bold text-primary flex items-center justify-center gap-3">
                <HelpCircle className="w-8 h-8 text-accent" />
                Frequently Asked Questions
              </h2>
            </div>
            
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="border rounded-2xl px-6 bg-card/50 backdrop-blur-sm">
                <AccordionTrigger className="text-primary font-bold hover:no-underline py-5 text-left">
                  Why do different liquids have different conversion rates?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  The relationship between weight (kg) and volume (L) is defined by density. For example, cooking oil is less dense than water, meaning 1 litre of oil weighs less than 1 kilogram. LitreLink accounts for these specific gravity variances to give you exact results.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border rounded-2xl px-6 bg-card/50 backdrop-blur-sm">
                <AccordionTrigger className="text-primary font-bold hover:no-underline py-5 text-left">
                  How does the "Swap" feature work?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  Clicking the swap button (or the icon at the top of the card) toggles the conversion direction. It allows you to calculate "How many litres in X kilograms" or "How many kilograms in X litres" instantly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border rounded-2xl px-6 bg-card/50 backdrop-blur-sm">
                <AccordionTrigger className="text-primary font-bold hover:no-underline py-5 text-left">
                  Can I use LitreLink offline?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  Yes! LitreLink is a Progressive Web App (PWA) capable tool. Once loaded, all conversion logic happens locally on your browser, requiring no server connection for the actual calculations.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          <section className="mt-32 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 px-4 mb-10">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-primary/5 rounded-full">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">Ultra Precise</h3>
              <p className="text-muted-foreground text-sm">Calculations are performed with up to 8 decimal points of floating-point precision before rounding for display.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-accent/5 rounded-full">
                <Info className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-primary">Liquid Profiles</h3>
              <p className="text-muted-foreground text-sm">Switch between pre-calibrated density profiles for Milk, Oils, and common fuels with one click.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-primary/5 rounded-full">
                <ArrowRightLeft className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">Reactive UI</h3>
              <p className="text-muted-foreground text-sm">Values update instantaneously as you type, providing immediate feedback for rapid workflows.</p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
