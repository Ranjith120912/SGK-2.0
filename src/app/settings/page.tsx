
"use client";

import { useState, useEffect, useRef } from "react";
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
import { Settings as SettingsIcon, Milk, Save, CheckCircle2, ShoppingBag, Building2, Upload, X, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [config, setConfig] = useState({ 
    companyName: "",
    address: "",
    stampUrl: "",
    cowRate: "", 
    buffaloRate: "", 
    cowSellingRate: "",
    buffaloSellingRate: "",
    kgToLitreRate: "0.96"
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
        stampUrl: currentSettings.stampUrl || "",
        cowRate: currentSettings.cowRate?.toString() || "",
        buffaloRate: currentSettings.buffaloRate?.toString() || "",
        cowSellingRate: currentSettings.cowSellingRate?.toString() || "",
        buffaloSellingRate: currentSettings.buffaloSellingRate?.toString() || "",
        kgToLitreRate: currentSettings.kgToLitreRate?.toString() || "0.96"
      });
    }
  }, [currentSettings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig(prev => ({ ...prev, stampUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeStamp = () => {
    setConfig(prev => ({ ...prev, stampUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    if (!firestore) return;
    setIsSaving(true);

    const data = {
      companyName: config.companyName,
      address: config.address,
      stampUrl: config.stampUrl,
      cowRate: parseFloat(config.cowRate) || 0,
      buffaloRate: parseFloat(config.buffaloRate) || 0,
      cowSellingRate: parseFloat(config.cowSellingRate) || 0,
      buffaloSellingRate: parseFloat(config.buffaloSellingRate) || 0,
      kgToLitreRate: parseFloat(config.kgToLitreRate) || 0.96,
      updatedAt: serverTimestamp()
    };

    setDocumentNonBlocking(doc(firestore, 'settings', 'milk_rates'), data, { merge: true });

    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Settings Saved", description: "System configuration updated successfully." });
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-black text-primary tracking-tight flex items-center gap-3 uppercase">
              <SettingsIcon className="w-8 h-8" />
              Configuration
            </h1>
            <p className="text-muted-foreground font-medium">Manage your company profile, pricing, and conversion standards.</p>
          </header>

          <div className="space-y-6">
            <Card className="rounded-[2rem] shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/10 p-6">
                <CardTitle className="text-xl font-black flex items-center gap-3 text-primary uppercase tracking-tighter">
                  <Building2 className="w-6 h-6" />
                  Company Profile & Branding
                </CardTitle>
                <CardDescription className="text-muted-foreground font-medium text-xs">Identity details reflected on invoices and reports.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Company Name</Label>
                      <Input 
                        placeholder="e.g. SRI GOPALA KRISHNA MILK DISTRIBUTIONS" 
                        className="h-12 rounded-xl font-bold border-primary/10 focus:border-primary transition-all" 
                        value={config.companyName} 
                        onChange={(e) => setConfig({ ...config, companyName: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Business Address</Label>
                      <Textarea 
                        placeholder="e.g. 123 Dairy Lane, Milk City" 
                        className="rounded-xl min-h-[100px] border-primary/10 focus:border-primary transition-all text-sm" 
                        value={config.address} 
                        onChange={(e) => setConfig({ ...config, address: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Official Business Stamp</Label>
                    <div className="relative group">
                      <div className={cn(
                        "h-[180px] w-full rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 bg-muted/20 overflow-hidden relative",
                        config.stampUrl ? "border-primary/40 bg-white" : "border-primary/10 hover:border-primary/30"
                      )}>
                        {config.stampUrl ? (
                          <>
                            <div className="relative w-full h-full p-4">
                              <img 
                                src={config.stampUrl} 
                                alt="Stamp Preview" 
                                className="w-full h-full object-contain mix-blend-multiply opacity-80"
                              />
                            </div>
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={removeStamp}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-primary/40" />
                            <div className="text-center px-4">
                              <p className="text-xs font-bold text-primary/60">Upload Stamp</p>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-tight">Visible on Invoices</p>
                            </div>
                          </>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-[1.5rem] shadow-lg border-none bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10 p-4">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-primary uppercase tracking-tighter">
                    <Milk className="w-4 h-4" />
                    Procurement Rates
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cow Milk (₹/L)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 text-xs font-black">₹</span>
                      <Input type="number" step="0.01" className="h-10 pl-7 rounded-lg font-bold border-primary/10" value={config.cowRate} onChange={(e) => setConfig({ ...config, cowRate: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Buffalo Milk (₹/L)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 text-xs font-black">₹</span>
                      <Input type="number" step="0.01" className="h-10 pl-7 rounded-lg font-bold border-primary/10" value={config.buffaloRate} onChange={(e) => setConfig({ ...config, buffaloRate: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem] shadow-lg border-none bg-accent/5 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-accent/10 border-b border-accent/10 p-4">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-accent uppercase tracking-tighter">
                    <ShoppingBag className="w-4 h-4" />
                    Sales Rates
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-accent/70">Cow Selling (₹/L)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/40 text-xs font-black">₹</span>
                      <Input type="number" step="0.01" className="h-10 pl-7 rounded-lg font-bold border-accent/20" value={config.cowSellingRate} onChange={(e) => setConfig({ ...config, cowSellingRate: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-accent/70">Buffalo Selling (₹/L)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/40 text-xs font-black">₹</span>
                      <Input type="number" step="0.01" className="h-10 pl-7 rounded-lg font-bold border-accent/20" value={config.buffaloSellingRate} onChange={(e) => setConfig({ ...config, buffaloSellingRate: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[1.5rem] shadow-lg border-none bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-muted/50 border-b p-4">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-foreground uppercase tracking-tighter">
                  <Scale className="w-4 h-4" />
                  Standards
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="max-w-[240px] space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Kg to Litre Rate</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.001" 
                      className="h-10 rounded-lg font-bold border-primary/10" 
                      value={config.kgToLitreRate} 
                      onChange={(e) => setConfig({ ...config, kgToLitreRate: e.target.value })} 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted-foreground opacity-50 uppercase">Rate</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving || isLoading} className="rounded-full px-10 h-12 shadow-xl hover:scale-105 active:scale-95 transition-all font-black uppercase tracking-widest text-sm">
                {isSaving ? <CheckCircle2 className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5 mr-2" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
