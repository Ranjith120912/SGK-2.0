
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
import { Textarea } from "@/components/ui/textarea";
import { Settings as SettingsIcon, Milk, Save, CheckCircle2, ShoppingBag, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [config, setConfig] = useState({ 
    companyName: "",
    address: "",
    cowRate: "", 
    buffaloRate: "", 
    cowSellingRate: "",
    buffaloSellingRate: "" 
  });
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: currentSettings, isLoading } = useDoc(settingsRef);

  useEffect(() => {
    if (currentSettings) {
      setConfig({
        companyName: currentSettings.companyName || "",
        address: currentSettings.address || "",
        cowRate: currentSettings.cowRate?.toString() || "",
        buffaloRate: currentSettings.buffaloRate?.toString() || "",
        cowSellingRate: currentSettings.cowSellingRate?.toString() || "",
        buffaloSellingRate: currentSettings.buffaloSellingRate?.toString() || ""
      });
    }
  }, [currentSettings]);

  const handleSave = () => {
    if (!firestore) return;
    setIsSaving(true);

    const data = {
      companyName: config.companyName,
      address: config.address,
      cowRate: parseFloat(config.cowRate) || 0,
      buffaloRate: parseFloat(config.buffaloRate) || 0,
      cowSellingRate: parseFloat(config.cowSellingRate) || 0,
      buffaloSellingRate: parseFloat(config.buffaloSellingRate) || 0,
      updatedAt: serverTimestamp()
    };

    setDocumentNonBlocking(doc(firestore, 'settings', 'milk_rates'), data, { merge: true });

    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Settings Saved", description: "Business details and rates updated successfully." });
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-black text-primary tracking-tight flex items-center gap-3">
              <SettingsIcon className="w-8 h-8" />
              Configuration
            </h1>
            <p className="text-muted-foreground">Manage your company profile and pricing rates.</p>
          </header>

          <div className="space-y-6">
            <Card className="rounded-3xl shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Company Profile
                </CardTitle>
                <CardDescription>Identity details reflected on invoices and reports.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Company Name</Label>
                  <Input 
                    placeholder="e.g. SRI GOPALA KRISHNA MILK DISTRIBUTIONS" 
                    className="h-12 rounded-xl font-bold" 
                    value={config.companyName} 
                    onChange={(e) => setConfig({ ...config, companyName: e.target.value })} 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Business Address (Optional)</Label>
                  <Textarea 
                    placeholder="e.g. 123 Dairy Lane, Milk City, State - 500001" 
                    className="rounded-xl min-h-[80px]" 
                    value={config.address} 
                    onChange={(e) => setConfig({ ...config, address: e.target.value })} 
                  />
                  <p className="text-[10px] text-muted-foreground italic">Leave empty to hide from invoices.</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-3xl shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden h-full">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Milk className="w-5 h-5 text-primary" />
                    Purchase Rates
                  </CardTitle>
                  <CardDescription>Prices (₹/L) paid to suppliers.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cow Milk Rate</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                      <Input type="number" step="0.01" className="h-12 pl-8 rounded-xl font-bold" value={config.cowRate} onChange={(e) => setConfig({ ...config, cowRate: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Buffalo Milk Rate</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                      <Input type="number" step="0.01" className="h-12 pl-8 rounded-xl font-bold" value={config.buffaloRate} onChange={(e) => setConfig({ ...config, buffaloRate: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-xl border-none bg-accent/5 backdrop-blur-sm overflow-hidden h-full border-2 border-accent/10">
                <CardHeader className="bg-accent/10 border-b border-accent/10">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-accent" />
                    Sales Rates
                  </CardTitle>
                  <CardDescription>Price (₹/L) charged to buyers.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-accent/70">Cow Selling Price</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent/60 font-bold">₹</span>
                      <Input type="number" step="0.01" className="h-12 pl-8 rounded-xl font-bold border-accent/20 focus:border-accent" value={config.cowSellingRate} onChange={(e) => setConfig({ ...config, cowSellingRate: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-accent/70">Buffalo Selling Price</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent/60 font-bold">₹</span>
                      <Input type="number" step="0.01" className="h-12 pl-8 rounded-xl font-bold border-accent/20 focus:border-accent" value={config.buffaloSellingRate} onChange={(e) => setConfig({ ...config, buffaloSellingRate: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving || isLoading} className="rounded-full px-10 h-12 shadow-lg">
                {isSaving ? <CheckCircle2 className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5 mr-2" />}
                {isSaving ? "Updating..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
