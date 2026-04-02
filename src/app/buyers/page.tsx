
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
import { UserPlus, Search, Contact, ClipboardList, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BuyersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ name: "", buyerCode: "", phone: "" });

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'buyers');
  }, [firestore]);

  const { data: buyers, isLoading } = useCollection(buyersQuery);

  const filteredBuyers = buyers?.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.buyerCode.includes(searchTerm)
  ).sort((a, b) => a.buyerCode.localeCompare(b.buyerCode));

  const handleAddBuyer = () => {
    if (!newBuyer.name || !newBuyer.buyerCode) {
      toast({ title: "Error", description: "Name and Code are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'buyers'), {
      ...newBuyer,
      active: true,
      createdAt: serverTimestamp(),
    });

    setNewBuyer({ name: "", buyerCode: "", phone: "" });
    setIsAdding(false);
    toast({ title: "Success", description: "Buyer added successfully." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">Buyer Management</h1>
              <p className="text-muted-foreground">Manage your milk distribution customers.</p>
            </div>
            <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"} className="rounded-full">
              <UserPlus className="w-4 h-4 mr-2" />
              {isAdding ? "Cancel" : "Add Buyer"}
            </Button>
          </div>

          {isAdding && (
            <Card className="mb-8 border-primary/20 bg-primary/5 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Contact className="w-5 h-5 text-primary" />
                  New Buyer Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase">Full Name</label>
                    <Input 
                      placeholder="e.g. City Dairy" 
                      value={newBuyer.name}
                      onChange={(e) => setNewBuyer({...newBuyer, name: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase">Buyer Code</label>
                    <Input 
                      placeholder="e.g. B-101" 
                      value={newBuyer.buyerCode}
                      onChange={(e) => setNewBuyer({...newBuyer, buyerCode: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase">Phone Number</label>
                    <Input 
                      placeholder="e.g. 9123456789" 
                      value={newBuyer.phone}
                      onChange={(e) => setNewBuyer({...newBuyer, phone: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleAddBuyer} className="rounded-full px-8">Save Buyer</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              className="pl-12 h-14 bg-card rounded-2xl border-primary/10 shadow-sm focus:ring-primary/20 text-lg" 
              placeholder="Search by name or code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow>
                  <TableHead className="w-[120px] font-bold text-primary pl-6">Code</TableHead>
                  <TableHead className="font-bold text-primary">Buyer Name</TableHead>
                  <TableHead className="font-bold text-primary">Phone</TableHead>
                  <TableHead className="text-right pr-6 font-bold text-primary">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground animate-pulse">Loading buyers...</TableCell></TableRow>
                ) : filteredBuyers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2">
                        <ClipboardList className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-medium">No buyers found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBuyers?.map((buyer) => (
                    <TableRow key={buyer.id} className="group hover:bg-primary/5 transition-colors">
                      <TableCell className="font-black text-primary pl-6 text-lg">{buyer.buyerCode}</TableCell>
                      <TableCell className="font-semibold text-base">{buyer.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono">{buyer.phone || "—"}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
