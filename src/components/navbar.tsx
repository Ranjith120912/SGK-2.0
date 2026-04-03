import Link from "next/link";
import { Droplets, ClipboardList, BarChart3, Settings, ShoppingCart, Calculator, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-primary/5 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-primary rounded-xl group-hover:scale-105 transition-transform duration-200 shadow-lg shadow-primary/20">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <span className="font-headline font-black text-lg sm:text-xl text-primary tracking-tighter uppercase truncate max-w-[150px] sm:max-w-none">
              SGK MILK DISTRIBUTIONS
            </span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex items-center gap-6">
              <Link href="/" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/farmers" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Users className="w-4 h-4" />
                Farmers
              </Link>
              <Link href="/entries" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Collection
              </Link>
              <Link href="/sales" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Sales
              </Link>
              <Link href="/converter" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Converter
              </Link>
              <Link href="/reports" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Reports
              </Link>
              <Link href="/settings" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </div>
            
            <div className="flex items-center gap-2 pl-2 sm:pl-4 border-l border-primary/10">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}