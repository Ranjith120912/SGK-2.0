
"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8">
            <h1 className="text-3xl font-black text-primary tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">Insights into your dairy collection and sales operations.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="rounded-3xl border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden group cursor-pointer hover:bg-primary/5 transition-all">
              <CardHeader className="pb-2">
                <div className="p-3 bg-primary/10 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg font-bold mb-2">Collection Summary</CardTitle>
                <p className="text-xs text-muted-foreground mb-4">View daily, weekly, and monthly collection volumes by farmer.</p>
                <Button variant="outline" className="w-full rounded-full">View Report</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden group cursor-pointer hover:bg-accent/5 transition-all">
              <CardHeader className="pb-2">
                <div className="p-3 bg-accent/10 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg font-bold mb-2">Sales Analysis</CardTitle>
                <p className="text-xs text-muted-foreground mb-4">Track milk distribution and revenue across all buyers.</p>
                <Button variant="outline" className="w-full rounded-full">View Report</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden group cursor-pointer hover:bg-secondary/5 transition-all">
              <CardHeader className="pb-2">
                <div className="p-3 bg-secondary/10 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6 text-secondary" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg font-bold mb-2">Payment Cycles</CardTitle>
                <p className="text-xs text-muted-foreground mb-4">Calculate totals and generate bill summaries for payment periods.</p>
                <Button variant="outline" className="w-full rounded-full">View Report</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden group cursor-pointer hover:bg-muted transition-all">
              <CardHeader className="pb-2">
                <div className="p-3 bg-background rounded-2xl w-fit group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg font-bold mb-2">Inventory Balance</CardTitle>
                <p className="text-xs text-muted-foreground mb-4">Reconcile total collection vs. total sales for any date range.</p>
                <Button variant="outline" className="w-full rounded-full">View Report</Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 p-12 border-2 border-dashed border-primary/10 rounded-[3rem] text-center flex flex-col items-center">
            <div className="p-6 bg-primary/5 rounded-full mb-4">
              <BarChart3 className="w-12 h-12 text-primary/30" />
            </div>
            <h3 className="text-xl font-black text-primary mb-2">Advanced Analytics Coming Soon</h3>
            <p className="text-muted-foreground max-w-md">We're building powerful visualization tools to help you optimize your dairy business data.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
