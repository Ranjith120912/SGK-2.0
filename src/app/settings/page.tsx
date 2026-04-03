"use client";

import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useDoc, useMemoFirebase, useFirestore, useCollection } from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings as SettingsIcon, 
  Milk, 
  Save, 
  CheckCircle2, 
  ShoppingBag, 
  Building2, 
  Upload, 
  X, 
  Scale,
  RefreshCcw,
  DatabaseZap,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [isResetting, setIsResetting] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const entriesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'entries');
  }, [firestore]);

  const salesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'sales');
  }, [firestore]);

  const farmersRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const { data: currentSettings, isLoading } = useDoc(settingsRef);
  const { data: allEntries } = useCollection(entriesRef);
  const { data: allSales } = useCollection(salesRef);
  const { data: allFarmers } = useCollection(farmersRef);

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
      reader.onloadend = () => setConfig(prev => ({ ...prev, stampUrl: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!firestore) return;
    setIsSaving(true);
    setDocumentNonBlocking(doc(firestore, 'settings', 'milk_rates'), {
      ...config,
      cowRate: parseFloat(config.cowRate) || 0,
      buffaloRate: parseFloat(config.buffaloRate) || 0,
      cowSellingRate: parseFloat(config.cowSellingRate) || 0,
      buffaloSellingRate: parseFloat(config.buffaloSellingRate) || 0,
      kgToLitreRate: parseFloat(config.kgToLitreRate) || 0.96,
      updatedAt: serverTimestamp()
    }, { merge: true });
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Settings Saved", description: "System updated successfully." });
    }, 800);
  };

  const masterReset = () => {
    if (!firestore) return;
    setIsResetting(true);
    
    // Batch deletion simulation (non-blocking per document)
    const entryCount = allEntries?.length || 0;
    const saleCount = allSales?.length || 0;
    const farmerCount = allFarmers?.length || 0;

    allEntries?.forEach(e => deleteDocumentNonBlocking(doc(firestore, 'entries', e.id)));
    allSales?.forEach(s => deleteDocumentNonBlocking(doc(firestore, 'sales', s.id)));
    allFarmers?.forEach(f => deleteDocumentNonBlocking(doc(firestore, 'farmers', f.id)));

    setTimeout(() => {
      setIsResetting(false);
      toast({ 
        title: "Master Reset Initiated", 
        description: `Wiping ${entryCount} entries, ${saleCount} sales, and ${farmerCount} farmers.`,
        variant: "destructive"
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-black text-primary tracking-tight flex items-center gap-3 uppercase">
              <SettingsIcon className="w-8 h-8" /> Configuration
            </h1>
            <p className="text-muted-foreground font-medium">Manage company profile, pricing, and system standards.</p>
          </header>

          <div className="space-y-8">
            <Card className="rounded-[2rem] border-2 border-destructive/20 bg-destructive/5 overflow-hidden shadow-xl">
              <CardHeader className="bg-destructive/10">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl font-black flex items-center gap-3 text-destructive uppercase">
                    <DatabaseZap className="w-6 h-6" /> Master Data Wipe
                  </CardTitle>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Farmers</p>
                      <p className="text-lg font-black text-destructive">{allFarmers?.length ?? '...'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Entries</p>
                      <p className="text-lg font-black text-destructive">{allEntries?.length ?? '...'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Sales</p>
                      <p className="text-lg font-black text-destructive">{allSales?.length ?? '...'}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="flex gap-4">
                  <AlertTriangle className="w-10 h-10 text-destructive animate-pulse" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-destructive leading-tight uppercase tracking-tight">System Purge Warning</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This will permanently delete ALL suppliers, collection logs, and sales records across your entire organization.
                    </p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="lg" className="rounded-full px-10 h-14 font-black uppercase shadow-xl" disabled={isResetting}>
                      {isResetting ? <Loader2 className="animate-spin mr-2" /> : <RefreshCcw className="mr-2" />} System Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-black text-destructive uppercase">Confirm Total Wipe</AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to delete all records from the database. This action is irreversible and will reset all reporting metrics to zero.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-full">Abort</AlertDialogCancel>
                      <AlertDialogAction onClick={masterReset} className="rounded-full bg-destructive">YES, WIPE EVERYTHING</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] shadow-lg border-none bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-primary/5 p-6 border-b border-primary/10">
                <CardTitle className="text-xl font-black flex items-center gap-3 text-primary uppercase">
                  <Building2 className="w-6 h-6" /> Business Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Name</Label>
                      <Input value={config.companyName} onChange={(e) => setConfig({ ...config, companyName: e.target.value })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Address</Label>
                      <Textarea value={config.address} onChange={(e) => setConfig({ ...config, address: e.target.value })} className="rounded-xl min-h-[80px]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Business Stamp (Visible on Invoice)</Label>
                    <div className="h-[160px] w-full rounded-2xl border-2 border-dashed border-primary/10 bg-muted/20 relative group overflow-hidden">
                      {config.stampUrl ? (
                        <>
                          <img src={config.stampUrl} className="w-full h-full object-contain p-4 mix-blend-multiply" />
                          <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100" onClick={() => setConfig({...config, stampUrl: ""})}><X /></Button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><Upload className="mb-2" /><p className="text-xs">Upload PNG/JPG</p></div>
                      )}
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-3xl border-none shadow-md p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2"><Milk className="w-4 h-4" /> Procurement Rates</CardTitle>
                <div className="space-y-4">
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Cow (₹/L)</Label><Input type="number" value={config.cowRate} onChange={(e) => setConfig({...config, cowRate: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Buffalo (₹/L)</Label><Input type="number" value={config.buffaloRate} onChange={(e) => setConfig({...config, buffaloRate: e.target.value})} /></div>
                </div>
              </Card>
              <Card className="rounded-3xl border-none shadow-md p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent mb-6 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Selling Rates</CardTitle>
                <div className="space-y-4">
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Cow (₹/L)</Label><Input type="number" value={config.cowSellingRate} onChange={(e) => setConfig({...config, cowSellingRate: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Buffalo (₹/L)</Label><Input type="number" value={config.buffaloSellingRate} onChange={(e) => setConfig({...config, buffaloSellingRate: e.target.value})} /></div>
                </div>
              </Card>
              <Card className="rounded-3xl border-none shadow-md p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground mb-6 flex items-center gap-2"><Scale className="w-4 h-4" /> Conversion Factor</CardTitle>
                <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Kg to Litre</Label><Input type="number" value={config.kgToLitreRate} onChange={(e) => setConfig({...config, kgToLitreRate: e.target.value})} /></div>
              </Card>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="rounded-full px-12 h-14 font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105">
                {isSaving ? <CheckCircle2 className="animate-pulse" /> : <Save className="mr-2" />} {isSaving ? "Saving..." : "Apply Changes"}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}