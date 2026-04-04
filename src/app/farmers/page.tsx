
"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  UserPlus, 
  Search, 
  FileUp, 
  ClipboardList, 
  CheckCircle2, 
  Download, 
  FileSpreadsheet,
  Upload,
  Trash2,
  X,
  Pencil,
  AlertTriangle,
  IndianRupee
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { read, utils, writeFile } from 'xlsx';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function FarmersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newFarmer, setNewFarmer] = useState({ name: "", canNumber: "", bankAccountNumber: "", ifscCode: "", milkType: "COW", customRate: "" });
  const [editingFarmer, setEditingFarmer] = useState<any>(null);
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

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
  }) || [];

  const handleAddFarmer = () => {
    if (!newFarmer.name || !newFarmer.canNumber) {
      toast({ title: "Error", description: "Name and Can Number are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'farmers'), {
      ...newFarmer,
      canNumber: newFarmer.canNumber.toString().padStart(3, '0'),
      customRate: newFarmer.milkType === 'BUFFALO' ? parseFloat(newFarmer.customRate) || 0 : 0,
      active: true,
      createdAt: serverTimestamp(),
    });

    setNewFarmer({ name: "", canNumber: "", bankAccountNumber: "", ifscCode: "", milkType: "COW", customRate: "" });
    setIsAdding(false);
    toast({ title: "Success", description: "Farmer added successfully." });
  };

  const handleUpdateFarmer = () => {
    if (!editingFarmer || !editingFarmer.name || !editingFarmer.canNumber) {
      toast({ title: "Error", description: "Name and Can Number are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    updateDocumentNonBlocking(doc(firestore, 'farmers', editingFarmer.id), {
      ...editingFarmer,
      canNumber: editingFarmer.canNumber.toString().padStart(3, '0'),
      customRate: editingFarmer.milkType === 'BUFFALO' ? parseFloat(editingFarmer.customRate) || 0 : 0,
      updatedAt: serverTimestamp(),
    });

    setEditingFarmer(null);
    toast({ title: "Updated", description: "Farmer details updated successfully." });
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredFarmers.map(f => f.id));
    } else {
      setSelectedIds([]);
    }
  };

  const confirmDeleteSelected = () => {
    if (!firestore || selectedIds.length === 0) return;
    
    selectedIds.forEach(id => {
      deleteDocumentNonBlocking(doc(firestore, 'farmers', id));
    });

    toast({ 
      title: "Deletion Successful", 
      description: `Removed ${selectedIds.length} farmers from the directory.` 
    });
    setSelectedIds([]);
    setIsDeleteDialogOpen(false);
  };

  const handleDeleteRow = (id: string, name: string) => {
    if (!firestore) return;
    
    deleteDocumentNonBlocking(doc(firestore, 'farmers', id));
    toast({ title: "Deleted", description: `Farmer "${name}" removed.` });
    
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const confirmClearAll = () => {
    if (!farmers || !firestore) return;
    
    const count = farmers.length;
    farmers.forEach(farmer => {
      deleteDocumentNonBlocking(doc(firestore, 'farmers', farmer.id));
    });
    
    toast({ 
      title: "Directory Cleared", 
      description: `All ${count} records have been removed.` 
    });
    setSelectedIds([]);
    setIsClearAllDialogOpen(false);
  };

  const processImportArray = (data: any[]) => {
    if (!firestore) return;
    let count = 0;
    data.forEach((item: any) => {
      const normalizedItem: any = {};
      Object.keys(item).forEach(key => {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
        normalizedItem[normalizedKey] = item[key];
      });

      const name = item.Name || item.name || normalizedItem.name || normalizedItem.farmername;
      const canNumber = item['Can Number'] || item.canNumber || normalizedItem.cannumber || normalizedItem.can;
      const bankAccountNumber = item['Bank Account Number'] || item['Account Number'] || item.bankAccountNumber || normalizedItem.bankaccountnumber || normalizedItem.accountnumber || normalizedItem.account;
      const ifscCode = item['IFSC Code'] || item.ifscCode || normalizedItem.ifsccode || normalizedItem.ifsc;
      const milkTypeRaw = item['Milk Type'] || item.milkType || normalizedItem.milktype || normalizedItem.type;
      const customRateRaw = item['Buffalo Rate'] || item.customRate || normalizedItem.buffalorate || normalizedItem.customrate;
      
      let milkType = "COW";
      if (milkTypeRaw?.toString().toUpperCase().includes("BUFFALO")) milkType = "BUFFALO";

      if (name && canNumber) {
        addDocumentNonBlocking(collection(firestore, 'farmers'), {
          name: name.toString(),
          canNumber: canNumber.toString().padStart(3, '0'),
          bankAccountNumber: (bankAccountNumber || "").toString(),
          ifscCode: (ifscCode || "").toString(),
          milkType: milkType,
          customRate: milkType === 'BUFFALO' ? parseFloat(customRateRaw) || 0 : 0,
          active: true,
          createdAt: serverTimestamp(),
        });
        count++;
      }
    });

    toast({ title: "Import Successful", description: `Added ${count} farmers.` });
    setIsImporting(false);
    setImportData("");
  };

  const handleBulkImportText = () => {
    try {
      let data: any[] = [];
      const trimmedData = importData.trim();
      
      if (!trimmedData) throw new Error("Please paste your data first.");

      if (trimmedData.startsWith('[')) {
        data = JSON.parse(trimmedData);
      } else {
        const lines = trimmedData.split('\n');
        if (lines.length < 1) throw new Error("No data found.");

        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(',') ? ',' : null);
        
        if (!delimiter) {
          throw new Error("Could not detect delimiter. Please use Comma (CSV) or paste directly from Excel (Tabs).");
        }

        const headers = lines[0].split(delimiter).map(h => h.trim());
        
        data = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(delimiter);
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = values[i]?.trim();
          });
          return obj;
        });
      }

      processImportArray(data);
    } catch (e: any) {
      toast({ title: "Import Failed", description: e.message || "Invalid format.", variant: "destructive" });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;
        const wb = read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = utils.sheet_to_json(ws);
        processImportArray(jsonData);
      } catch (error) {
        toast({ title: "File Error", description: "Could not read the Excel file.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      { "Name": "Rajesh Kumar", "Can Number": "101", "Bank Account Number": "9876543210", "IFSC Code": "SBIN0001234", "Milk Type": "COW", "Buffalo Rate": "" },
      { "Name": "Suresh Singh", "Can Number": "102", "Bank Account Number": "1234567890", "IFSC Code": "HDFC0005678", "Milk Type": "BUFFALO", "Buffalo Rate": "55.50" }
    ];
    const ws = utils.json_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Farmers Template");
    writeFile(wb, "Farmers_Import_Template.xlsx");
    
    toast({ title: "Template Downloaded", description: "Excel template is ready." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">Farmer Management</h1>
              <p className="text-muted-foreground">Directory of suppliers and bank details.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedIds.length > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={() => setIsDeleteDialogOpen(true)} 
                  className="rounded-full shadow-lg animate-in zoom-in duration-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedIds.length})
                </Button>
              )}

              <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"} className="rounded-full">
                {isAdding ? <X className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
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
                        Upload your .xlsx file with Name, Can Number, Bank Details, and Milk Type.
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                          <Upload className="w-3 h-3" /> Step 1: Upload File
                        </label>
                        <Input 
                          type="file" 
                          accept=".xlsx, .xls, .csv" 
                          onChange={handleFileUpload}
                          className="rounded-xl h-24 border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors file:hidden text-center pt-8 text-muted-foreground font-medium"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                          <Download className="w-3 h-3" /> Step 2: Download Format
                        </label>
                        <div className="bg-muted/50 rounded-2xl p-4 border border-primary/10 flex flex-col items-center justify-center h-24 gap-2">
                          <Button variant="outline" size="sm" onClick={downloadExcelTemplate} className="rounded-full w-full bg-background shadow-sm">
                            <Download className="w-3 h-3 mr-2" /> Download Template (.xlsx)
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                        <ClipboardList className="w-4 h-4" />
                        Or Paste Data
                      </label>
                      <Textarea 
                        placeholder="Name, Can Number, Account, IFSC, Milk Type, Buffalo Rate..." 
                        value={importData}
                        onChange={(e) => setImportData(e.target.value)}
                        className="min-h-[120px] font-mono text-xs rounded-2xl border-primary/20 bg-background/50"
                      />
                    </div>
                  </div>

                  <div className="bg-muted/50 p-6 flex justify-end gap-2 border-t">
                    <Button variant="ghost" onClick={() => setIsImporting(false)} className="rounded-full">Cancel</Button>
                    <Button onClick={handleBulkImportText} className="rounded-full px-8 shadow-md" disabled={!importData}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Process Text
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button 
                variant="ghost" 
                onClick={() => setIsClearAllDialogOpen(true)} 
                className="rounded-full text-destructive border border-dashed hover:bg-destructive/10"
                disabled={!farmers || farmers.length === 0}
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Clear All
              </Button>
            </div>
          </div>

          {isAdding && (
            <Card className="mb-8 border-primary/20 bg-primary/5 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 uppercase tracking-tight font-black">
                  <UserPlus className="w-5 h-5 text-primary" />
                  New Farmer Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Full Name</label>
                    <Input 
                      placeholder="e.g. John Doe" 
                      value={newFarmer.name}
                      onChange={(e) => setNewFarmer({...newFarmer, name: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Can Number</label>
                    <Input 
                      placeholder="e.g. 101" 
                      value={newFarmer.canNumber}
                      onChange={(e) => setNewFarmer({...newFarmer, canNumber: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Milk Type</label>
                    <Select value={newFarmer.milkType} onValueChange={(v) => setNewFarmer({...newFarmer, milkType: v})}>
                      <SelectTrigger className="rounded-xl h-11 border-primary/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COW">COW</SelectItem>
                        <SelectItem value="BUFFALO">BUFFALO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newFarmer.milkType === 'BUFFALO' && (
                    <div className="space-y-2 animate-in slide-in-from-left-2">
                      <label className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Buffalo Rate (₹)</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-accent" />
                        <Input 
                          type="number"
                          placeholder="e.g. 55.00" 
                          value={newFarmer.customRate}
                          onChange={(e) => setNewFarmer({...newFarmer, customRate: e.target.value})}
                          className="rounded-xl h-11 border-accent/20 pl-8 font-bold"
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Account Number</label>
                    <Input 
                      placeholder="e.g. 9123456789" 
                      value={newFarmer.bankAccountNumber}
                      onChange={(e) => setNewFarmer({...newFarmer, bankAccountNumber: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">IFSC Code</label>
                    <Input 
                      placeholder="e.g. SBIN0001234" 
                      value={newFarmer.ifscCode}
                      onChange={(e) => setNewFarmer({...newFarmer, ifscCode: e.target.value})}
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
              placeholder="Search by Name or Can Number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px] pl-6 py-5">
                    <Checkbox 
                      checked={filteredFarmers.length > 0 && selectedIds.length === filteredFarmers.length} 
                      onCheckedChange={(checked) => toggleSelectAll(checked === true)} 
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-[100px] font-black text-primary py-5 uppercase text-[10px] tracking-widest">CAN</TableHead>
                  <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Farmer Name</TableHead>
                  <TableHead className="w-[120px] font-black text-primary uppercase text-[10px] tracking-widest">Milk Type</TableHead>
                  <TableHead className="w-[120px] font-black text-accent uppercase text-[10px] tracking-widest">Rate (₹)</TableHead>
                  <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Bank Details</TableHead>
                  <TableHead className="text-right pr-6 font-black text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground animate-pulse font-medium">Loading farmer directory...</TableCell></TableRow>
                ) : filteredFarmers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <ClipboardList className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-semibold">No farmers found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFarmers.map((farmer) => (
                    <TableRow key={farmer.id} className={cn("group transition-colors border-b last:border-0", selectedIds.includes(farmer.id) ? "bg-primary/5" : "hover:bg-primary/5")}>
                      <TableCell className="pl-6">
                        <Checkbox 
                          checked={selectedIds.includes(farmer.id)} 
                          onCheckedChange={(checked) => toggleSelect(farmer.id, checked === true)} 
                          aria-label={`Select ${farmer.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-black text-primary text-lg">{farmer.canNumber}</TableCell>
                      <TableCell className="font-bold text-base text-foreground/80">{farmer.name}</TableCell>
                      <TableCell>
                        <Badge variant={farmer.milkType === 'BUFFALO' ? "secondary" : "outline"} className="rounded-full font-black text-[10px] uppercase">
                          {farmer.milkType || 'COW'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {farmer.milkType === 'BUFFALO' && farmer.customRate ? (
                          <div className="flex items-center gap-1 font-black text-accent">
                            <IndianRupee className="w-3 h-3" />
                            {parseFloat(farmer.customRate).toFixed(2)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Default</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="text-muted-foreground font-mono font-medium">{farmer.bankAccountNumber || "—"}</span>
                          {farmer.ifscCode && <span className="text-primary/60 font-black uppercase text-[9px] tracking-widest">{farmer.ifscCode}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-full text-primary hover:bg-primary/10"
                            onClick={() => setEditingFarmer(farmer)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-full text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteRow(farmer.id, farmer.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="p-5 bg-muted/20 text-center text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] border-t">
              Active Directory Suppliers: {farmers?.length || 0}
            </div>
          </Card>
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingFarmer} onOpenChange={(open) => !open && setEditingFarmer(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary uppercase tracking-tight">Edit Farmer Details</DialogTitle>
            <DialogDescription>Update supplier information and account records.</DialogDescription>
          </DialogHeader>
          
          {editingFarmer && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Full Name</label>
                  <Input 
                    value={editingFarmer.name} 
                    onChange={(e) => setEditingFarmer({...editingFarmer, name: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Can Number</label>
                  <Input 
                    value={editingFarmer.canNumber} 
                    onChange={(e) => setEditingFarmer({...editingFarmer, canNumber: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Milk Type</label>
                <Select value={editingFarmer.milkType} onValueChange={(v) => setEditingFarmer({...editingFarmer, milkType: v})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COW">COW</SelectItem>
                    <SelectItem value="BUFFALO">BUFFALO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingFarmer.milkType === 'BUFFALO' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-accent uppercase tracking-widest">Buffalo Rate (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-accent" />
                    <Input 
                      type="number"
                      step="0.01"
                      value={editingFarmer.customRate} 
                      onChange={(e) => setEditingFarmer({...editingFarmer, customRate: e.target.value})}
                      className="rounded-xl pl-8 font-bold border-accent/20"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bank Account Number</label>
                <Input 
                  value={editingFarmer.bankAccountNumber} 
                  onChange={(e) => setEditingFarmer({...editingFarmer, bankAccountNumber: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">IFSC Code</label>
                <Input 
                  value={editingFarmer.ifscCode} 
                  onChange={(e) => setEditingFarmer({...editingFarmer, ifscCode: e.target.value})}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setEditingFarmer(null)} className="rounded-full">Cancel</Button>
            <Button onClick={handleUpdateFarmer} className="rounded-full px-8 shadow-md">Update Farmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase">
              <AlertTriangle className="w-5 h-5" /> Confirm Bulk Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedIds.length} selected farmers from your directory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel Action</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelected} className="rounded-full bg-destructive hover:bg-destructive/90">
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Alert */}
      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase">
              <Trash2 className="w-5 h-5" /> Wipe Entire Directory?
            </AlertDialogTitle>
            <AlertDialogDescription>
              CRITICAL: You are about to delete ALL {farmers?.length || 0} farmers. This is an irreversible operation that will clear your entire supplier roster.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Abort</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAll} className="rounded-full bg-destructive hover:bg-destructive/90">
              Wipe Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
