
"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Milk, Save, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [rates, setRates] = useState({ cowRate: "", buffaloRate: "" });
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: currentSettings, isLoading } = useDoc(settingsRef);

  useEffect(() => {
    if (currentSettings) {
      setRates({
        cowRate: currentSettings.cowRate?.toString() || "",
        buffaloRate: currentSettings.buffaloRate?.toString() || ""
      });
    }
  }, [currentSettings]);

  const handleSave = () => {
    if (!firestore) return;
    setIsSaving(true);

    const data = {
      cowRate: parseFloat(rates.cowRate) || 0,
      buffaloRate: parseFloat(rates.buffaloRate) || 0,
      updatedAt: serverTimestamp()
    };

    setDocumentNonBlocking(doc(firestore, 'settings', 'milk_rates'), data, { merge: true });

    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Settings Saved",
        description: "Milk rates have been updated successfully.",
      });
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-black text-primary tracking-tight flex items-center gap-3">
              <SettingsIcon className="w-8 h-8" />
              Configuration
            </h1>
            <p className="text-muted-foreground">Manage global rates and system preferences.</p>
          </header>

          <Card className="rounded-3xl shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-xl flex items-center gap-2">
                <Milk className="w-5 h-5 text-primary" />
                Milk Rate Settings
              </CardTitle>
              <CardDescription>Define separate purchase rates for Cow and Buffalo milk.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="cowRate" className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Cow Milk Rate (₹/Litre)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                    <Input 
                      id="cowRate"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      className="h-14 pl-8 rounded-2xl text-xl font-bold border-primary/10"
                      value={rates.cowRate}
                      onChange={(e) => setRates({ ...rates, cowRate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="buffaloRate" className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Buffalo Milk Rate (₹/Litre)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                    <Input 
                      id="buffaloRate"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      className="h-14 pl-8 rounded-2xl text-xl font-bold border-primary/10"
                      value={rates.buffaloRate}
                      onChange={(e) => setRates({ ...rates, buffaloRate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex items-center justify-between">
                <p className="text-xs text-muted-foreground italic max-w-[200px]">
                  These rates will be used to calculate daily payment amounts for all farmers.
                </p>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || isLoading}
                  className="rounded-full px-10 h-12 shadow-lg hover:shadow-primary/20 transition-all"
                >
                  {isSaving ? <CheckCircle2 className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5 mr-2" />}
                  {isSaving ? "Updating..." : "Save Rates"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
