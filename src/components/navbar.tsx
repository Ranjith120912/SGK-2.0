
import Link from "next/link";
import { Scale } from "lucide-react";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-primary/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-primary rounded-lg group-hover:scale-105 transition-transform duration-200">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <span className="font-headline font-bold text-xl text-primary tracking-tight">LitreLink</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Converter</Link>
            <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Density API</Link>
            <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
