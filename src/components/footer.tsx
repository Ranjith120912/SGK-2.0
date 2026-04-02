
export function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-primary/5 bg-background">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
        <div className="flex gap-8 text-sm font-medium text-muted-foreground">
          <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms</a>
          <a href="#" className="hover:text-primary transition-colors">Support</a>
        </div>
        <div className="text-sm text-muted-foreground/60 font-body">
          &copy; {new Date().getFullYear()} LitreLink Conversion Engine. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
