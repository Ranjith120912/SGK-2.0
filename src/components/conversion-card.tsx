
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scale, Droplets, ArrowRightLeft, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const CONVERSION_RATE = 0.97;

export function ConversionCard() {
  const [kilograms, setKilograms] = useState<string>("");
  const [litres, setLitres] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const kgValue = parseFloat(kilograms);
    if (!isNaN(kgValue)) {
      setLitres(kgValue * CONVERSION_RATE);
    } else {
      setLitres(null);
    }
  }, [kilograms]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setKilograms(value);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 sm:p-6">
      <Card className="shadow-xl border-none overflow-hidden bg-card/80 backdrop-blur-sm transition-all duration-300">
        <CardHeader className="text-center space-y-2 pb-8">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <ArrowRightLeft className="w-8 h-8 text-primary animate-pulse-subtle" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline font-bold text-primary tracking-tight">
            LitreLink
          </CardTitle>
          <CardDescription className="text-muted-foreground font-body text-base">
            Precise Kilogram to Litre Converter
          </CardDescription>
          <div className="flex justify-center pt-2">
            <Badge variant="secondary" className="px-4 py-1 text-xs font-medium bg-accent/20 text-primary border-accent/30 flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              Rate: 1 kg = {CONVERSION_RATE} Litre
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pb-10">
          {/* Kilogram Input Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <Label htmlFor="kilograms" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                Kilograms (kg)
              </Label>
              {kilograms && (
                <span className="text-xs text-primary font-medium bg-primary/5 px-2 py-0.5 rounded-full">Input</span>
              )}
            </div>
            <div className="relative group">
              <Input
                id="kilograms"
                type="text"
                inputMode="decimal"
                placeholder="Enter weight in kg..."
                value={kilograms}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className={cn(
                  "h-16 text-2xl font-semibold pl-4 transition-all duration-300 border-2",
                  isFocused ? "border-primary ring-4 ring-primary/5" : "border-muted-foreground/10 hover:border-primary/50"
                )}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-bold">
                KG
              </div>
            </div>
          </div>

          {/* Decorative Divider */}
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-muted to-transparent" />
            <div className="p-1 rounded-full bg-muted/50">
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-muted to-transparent" />
          </div>

          {/* Litre Output Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Droplets className="w-4 h-4 text-accent" />
                Litres (L)
              </Label>
              {litres !== null && (
                <span className="text-xs text-accent font-medium bg-accent/5 px-2 py-0.5 rounded-full">Calculated</span>
              )}
            </div>
            <div className={cn(
              "h-20 flex items-center px-4 rounded-xl transition-all duration-500 bg-accent/5 border-2 border-accent/20 relative group",
              litres !== null ? "bg-accent/10 border-accent/40" : ""
            )}>
              <span className={cn(
                "text-3xl font-bold tracking-tight transition-all duration-300",
                litres !== null ? "text-primary" : "text-muted-foreground/30"
              )}>
                {litres !== null ? litres.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "0.00"}
              </span>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-accent/40 font-bold uppercase tracking-widest text-sm">
                Litres
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Reference Table */}
      <div className="mt-12 text-center">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-4">Quick Reference</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 5, 10, 50].map((val) => (
            <div key={val} className="p-3 bg-white/50 backdrop-blur-sm rounded-lg border border-primary/5 text-sm font-medium hover:border-primary/20 transition-colors">
              <div className="text-primary font-bold">{val} kg</div>
              <div className="text-muted-foreground">{(val * CONVERSION_RATE).toFixed(2)} L</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
