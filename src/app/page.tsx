import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-24 text-foreground">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <h1 className="max-w-xl text-center font-serif text-4xl font-medium tracking-tight sm:text-5xl">
        MDPVA Members
      </h1>
      <p className="max-w-md text-center text-muted-foreground">
        Design system scaffold — mdpva tokens, dark theme, and shadcn
        components are wired up.
      </p>
      <Button>Get started</Button>
    </div>
  );
}
