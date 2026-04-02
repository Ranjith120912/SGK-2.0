import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DashboardStats } from "@/components/dashboard-stats";
import Link from "next/link";
import { PlusCircle, Users, Settings, ShoppingCart, BarChart3, UserCheck } from "lucide-react";

export default function Home() {
  const quickActions = [
    { href: "/entries", label: "Collection", icon: PlusCircle, color: "text-primary", bg: "bg-primary/10" },
    { href: "/sales", label: "Sales", icon: ShoppingCart, color: "text-accent", bg: "bg-accent/10" },
    { href: "/farmers", label: "Farmers", icon: Users, color: "text-secondary", bg: "bg-secondary/10" },
    { href: "/buyers", label: "Buyers", icon: UserCheck, color: "text-orange-500", bg: "bg-orange-500/10" },
    { href: "/reports", label: "Reports", icon: BarChart3, color: "text-green-500", bg: "bg-green-500/10" },
    { href: "/settings", label: "Settings", icon: Settings, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="min-h-screen flex flex-col font-body bg-background selection:bg-accent/30">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8">
            <h1 className="text-4xl font-black text-primary tracking-tight mb-2">
              SGK MILK Dashboard
            </h1>
            <p className="text-muted-foreground">
              Real-time monitoring and dairy distribution management.
            </p>
          </header>

          {/* Compact Top Navigation / Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="group p-4 bg-card border rounded-2xl hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 ${action.bg} rounded-xl group-hover:scale-110 transition-transform`}>
                    <action.icon className={`w-6 h-6 ${action.color}`} />
                  </div>
                  <h3 className="text-sm font-black text-primary">{action.label}</h3>
                </div>
              </Link>
            ))}
          </div>

          <DashboardStats />
        </div>
      </main>

      <Footer />
    </div>
  );
}
