
import Link from "next/link";
import { Scale, Users, ClipboardList, BarChart3, Settings, ShoppingCart, Contact } from "lucide-react";

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
          <div className="hidden lg:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/entries" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Collection
            </Link>
            <Link href="/farmers" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <Users className="w-4 h-4" />
              Farmers
            </Link>
            <Link href="/sales" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Sales
            </Link>
            <Link href="/buyers" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <Contact className="w-4 h-4" />
              Buyers
            </Link>
            <Link href="/reports" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Reports
            </Link>
            <Link href="/settings" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
