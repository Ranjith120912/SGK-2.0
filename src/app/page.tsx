
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DashboardStats } from "@/components/dashboard-stats";
import Link from "next/link";
import { PlusCircle, ListChecks, Users, ShoppingCart, Contact } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-body bg-background selection:bg-accent/30">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-4xl font-black text-primary tracking-tight mb-2">
              Milk Management Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor daily collection and manage your distribution network.
            </p>
          </header>

          <DashboardStats />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            <Link href="/entries">
              <div className="group p-8 bg-card border rounded-3xl hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col items-center text-center space-y-4 h-full">
                <div className="p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <PlusCircle className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary">Daily Collection</h3>
                <p className="text-sm text-muted-foreground">Record morning and evening milk collection from farmers.</p>
              </div>
            </Link>

            <Link href="/sales">
              <div className="group p-8 bg-card border rounded-3xl hover:border-accent/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col items-center text-center space-y-4 h-full">
                <div className="p-4 bg-accent/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-primary">Daily Sales</h3>
                <p className="text-sm text-muted-foreground">Track milk distribution and sales to buyers.</p>
              </div>
            </Link>

            <Link href="/farmers">
              <div className="group p-8 bg-card border rounded-3xl hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col items-center text-center space-y-4 h-full">
                <div className="p-4 bg-secondary/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-primary">Farmers</h3>
                <p className="text-sm text-muted-foreground">Manage your milk suppliers and accounts.</p>
              </div>
            </Link>

            <Link href="/buyers">
              <div className="group p-8 bg-card border rounded-3xl hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col items-center text-center space-y-4 h-full">
                <div className="p-4 bg-muted rounded-2xl group-hover:scale-110 transition-transform">
                  <Contact className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary">Buyers</h3>
                <p className="text-sm text-muted-foreground">Manage customers who buy milk from you.</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
