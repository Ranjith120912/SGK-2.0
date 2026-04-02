
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
import { UserPlus, Database, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", canNumber: "", accountNumber: "" });

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);

  const { data: customers, isLoading } = useCollection(customersQuery);

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.canNumber.includes(searchTerm)
  ).sort((a, b) => parseInt(a.canNumber) - parseInt(b.canNumber));

  const handleAddCustomer = () => {
    if (!newCustomer.name || !newCustomer.canNumber) {
      toast({ title: "Error", description: "Name and CAN number are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'customers'), {
      ...newCustomer,
      active: true,
      createdAt: serverTimestamp(),
    });

    setNewCustomer({ name: "", canNumber: "", accountNumber: "" });
    setIsAdding(false);
    toast({ title: "Success", description: "Customer added successfully." });
  };

  const seedData = () => {
    if (!firestore) return;
    toast({ title: "Seeding...", description: "Adding 50 sample customers." });
    for (let i = 1; i <= 50; i++) {
      addDocumentNonBlocking(collection(firestore, 'customers'), {
        name: `Supplier ${i}`,
        canNumber: i.toString().padStart(3, '0'),
        accountNumber: `ACC-${i.toString().padStart(6, '0')}`,
        active: true,
        createdAt: serverTimestamp(),
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">Customer Management</h1>
              <p className="text-muted-foreground">Directory of milk suppliers and can numbers.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAdding(!isAdding)} className="rounded-full">
                <UserPlus className="w-4 h-4 mr-2" />
                {isAdding ? "Cancel" : "Add Customer"}
              </Button>
              <Button variant="outline" onClick={seedData} className="rounded-full">
                <Database className="w-4 h-4 mr-2" />
                Seed 50+
              </Button>
            </div>
          </div>

          {isAdding && (
            <Card className="mb-8 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">New Customer Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Full Name" 
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Input 
                    placeholder="CAN Number (e.g. 001)" 
                    value={newCustomer.canNumber}
                    onChange={(e) => setNewCustomer({...newCustomer, canNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Input 
                    placeholder="Account Number" 
                    value={newCustomer.accountNumber}
                    onChange={(e) => setNewCustomer({...newCustomer, accountNumber: e.target.value})}
                  />
                </div>
                <div className="sm:col-span-3 flex justify-end">
                  <Button onClick={handleAddCustomer}>Save Customer</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              className="pl-10 h-12 bg-card rounded-2xl border-primary/10" 
              placeholder="Search by name or CAN number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">CAN</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10">Loading customers...</TableCell></TableRow>
                ) : filteredCustomers?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10">No customers found.</TableCell></TableRow>
                ) : (
                  filteredCustomers?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-bold text-primary">{customer.canNumber}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.accountNumber || "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Edit</Button>
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
