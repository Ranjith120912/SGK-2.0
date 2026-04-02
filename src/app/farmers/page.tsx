
"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  UserPlus, 
  Database, 
  Search, 
  FileUp, 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  FileSpreadsheet,
  Table as TableIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FarmersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newFarmer, setNewFarmer] = useState({ name: "", canNumber: "", accountNumber: "" });
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const { data: farmers, isLoading } = useCollection(farmersQuery);

  const filteredFarmers = farmers?.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.canNumber.includes(searchTerm)
  ).sort((a, b) => {
    const aNum = parseInt(a.canNumber);
    const bNum = parseInt(b.canNumber);
    if (isNaN(aNum) || isNaN(bNum)) return a.canNumber.localeCompare(b.canNumber);
    return aNum - bNum;
  });

  const handleAddFarmer = () => {
    if (!newFarmer.name || !newFarmer.canNumber) {
      toast({ title: "Error", description: "Name and Can Number are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'farmers'), {
      ...newFarmer,
      canNumber: newFarmer.canNumber.toString().padStart(3, '0'),
      active: true,
      createdAt: serverTimestamp(),
    });

    setNewFarmer({ name: "", canNumber: "", accountNumber: "" });
    setIsAdding(false);
    toast({ title: "Success", description: "Farmer added successfully." });
  };

  const handleBulkImport = () => {
    if (!firestore) return;
    try {
      let data: any[] = [];
      const trimmedData = importData.trim();
      
      if (!trimmedData) throw new Error("Please paste your data first.");

      if (trimmedData.startsWith('[')) {
        data = JSON.parse(trimmedData);
      } else {
        const lines = trimmedData.split('\n');
        // Simple CSV parser
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
        
        data = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, i) => {
            // Map specifically to our schema keys
            if (header.includes('name')) obj.name = values[i];
            else if (header.includes('can')) obj.canNumber = values[i];
            else if (header.includes('account')) obj.accountNumber = values[i];
            else obj[header] = values[i];
          });
          return obj;
        });
      }

      let count = 0;
      data.forEach((item: any) => {
        if (item.name && item.canNumber) {
          addDocumentNonBlocking(collection(firestore, 'farmers'), {
            name: item.name,
            canNumber: item.canNumber.toString().padStart(3, '0'),
            accountNumber: item.accountNumber || "",
            active: true,
            createdAt: serverTimestamp(),
          });
          count++;
        }
      });

      toast({ title: "Import Successful", description: `Added ${count} farmers.` });
      setImportData("");
      setIsImporting(false);
    } catch (e: any) {
      toast({ title: "Import Failed", description: e.message || "Invalid format. Ensure you have Name, Can Number, and Account Number headers.", variant: "destructive" });
    }
  };

  const seedData = () => {
    if (!firestore) return;
    toast({ title: "Seeding...", description: "Adding 50 sample farmers." });
    for (let i = 1; i <= 50; i++) {
      addDocumentNonBlocking(collection(firestore, 'farmers'), {
        name: `Farmer ${i}`,
        canNumber: i.toString().padStart(3, '0'),
        accountNumber: `ACC-${i.toString().padStart(6, '0')}`,
        active: true,
        createdAt: serverTimestamp(),
      });
    }
  };

  const downloadExcelTemplate = () => {
    const headers = ["Name", "Can Number", "Account Number"];
    const rows = [
      ["Rajesh Kumar", "101", "9876543210"],
      ["Suresh Singh", "102", "1234567890"]
    ];
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "farmers_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Template Ready", description: "Excel-compatible template downloaded." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">Farmer Management</h1>
              <p className="text-muted-foreground">Directory of suppliers and bank account details.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"} className="rounded-full">
                <UserPlus className="w-4 h-4 mr-2" />
                {isAdding ? "Cancel" : "Add Farmer"}
              </Button>
              
              <Dialog open={isImporting} onOpenChange={setIsImporting}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="rounded-full">
                    <FileUp className="w-4 h-4 mr-2" />
                    Bulk Import
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] rounded-3xl overflow-hidden p-0">
                  <div className="bg-primary p-6 text-primary-foreground">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6" />
                        Excel Bulk Import
                      </DialogTitle>
                      <DialogDescription className="text-primary-foreground/80">
                        Follow the 3-column format shown below to import your farmer list.
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider">
                          <TableIcon className="w-4 h-4" />
                          Excel Column Structure
                        </h4>
                        <Button variant="outline" size="sm" onClick={downloadExcelTemplate} className="rounded-full h-8 text-xs">
                          <Download className="w-3 h-3 mr-2" /> Download Template
                        </Button>
                      </div>
                      
                      <div className="border rounded-xl overflow-hidden bg-muted/30 shadow-inner">
                        <Table className="text-[11px]">
                          <TableHeader className="bg-muted">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-10 font-black text-primary border-r">Column A (Name)</TableHead>
                              <TableHead className="h-10 font-black text-primary border-r">Column B (Can Number)</TableHead>
                              <TableHead className="h-10 font-black text-primary">Column C (Account Number)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="hover:bg-transparent border-b">
                              <TableCell className="py-3 border-r">Rajesh Kumar</TableCell>
                              <TableCell className="py-3 border-r">101</TableCell>
                              <TableCell className="py-3">9876543210</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-transparent">
                              <TableCell className="py-3 border-r text-muted-foreground/50 italic">...</TableCell>
                              <TableCell className="py-3 border-r text-muted-foreground/50 italic">...</TableCell>
                              <TableCell className="py-3 text-muted-foreground/50 italic">...</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                        <ClipboardList className="w-4 h-4" />
                        Paste Column Data
                      </label>
                      <p className="text-xs text-muted-foreground">Copy rows from your Excel sheet and paste them here. Include headers on the first line.</p>
                      <Textarea 
                        placeholder="Name,Can Number,Account Number&#10;John Doe,101,9123456789" 
                        value={importData}
                        onChange={(e) => setImportData(e.target.value)}
                        className="min-h-[160px] font-mono text-xs rounded-2xl border-primary/20 bg-background/50 focus:bg-background transition-colors"
                      />
                    </div>
                  </div>

                  <div className="bg-muted/50 p-6 flex flex-col sm:flex-row gap-4 justify-between items-center border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium italic">
                      <AlertCircle className="w-4 h-4 text-accent animate-pulse" />
                      Must include headers in the first row
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setIsImporting(false)} className="rounded-full">Cancel</Button>
                      <Button onClick={handleBulkImport} className="rounded-full px-8 shadow-md">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Start Import
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="ghost" onClick={seedData} className="rounded-full text-muted-foreground border-dashed border-2 hover:bg-muted/50">
                <Database className="w-4 h-4 mr-2" />
                Seed 50 Samples
              </Button>
            </div>
          </div>

          {isAdding && (
            <Card className="mb-8 border-primary/20 bg-primary/5 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  New Farmer Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Full Name</label>
                    <Input 
                      placeholder="e.g. John Doe" 
                      value={newFarmer.name}
                      onChange={(e) => setNewFarmer({...newFarmer, name: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Can Number</label>
                    <Input 
                      placeholder="e.g. 101" 
                      value={newFarmer.canNumber}
                      onChange={(e) => setNewFarmer({...newFarmer, canNumber: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Account Number</label>
                    <Input 
                      placeholder="e.g. 9123456789" 
                      value={newFarmer.accountNumber}
                      onChange={(e) => setNewFarmer({...newFarmer, accountNumber: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleAddFarmer} className="rounded-full px-8 shadow-md">Save Farmer</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              className="pl-12 h-14 bg-card rounded-2xl border-primary/10 shadow-sm focus:ring-primary/20 text-lg" 
              placeholder="Quick search by Name or Can Number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px] font-black text-primary pl-6 py-5">CAN</TableHead>
                  <TableHead className="font-black text-primary">Farmer Name</TableHead>
                  <TableHead className="font-black text-primary">Account Number</TableHead>
                  <TableHead className="text-right pr-6 font-black text-primary">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground animate-pulse font-medium">Loading farmer directory...</TableCell></TableRow>
                ) : filteredFarmers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-muted rounded-full">
                          <ClipboardList className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <p className="text-muted-foreground font-semibold">No farmers found matching your search.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFarmers?.map((farmer) => (
                    <TableRow key={farmer.id} className="group hover:bg-primary/5 transition-colors border-b last:border-0">
                      <TableCell className="font-black text-primary pl-6 text-lg">{farmer.canNumber}</TableCell>
                      <TableCell className="font-bold text-base text-foreground/80">{farmer.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono font-medium">{farmer.accountNumber || "—"}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-bold text-primary">Edit Profile</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="p-5 bg-muted/20 text-center text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] border-t">
              Total Active Suppliers: {farmers?.length || 0}
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
