import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(128),
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (import.meta.env.DEV) return <Navigate to="/" />;
  if (!loading && user) return <Navigate to="/" />;

  const handle = async (mode: "signin" | "signup", form: HTMLFormElement) => {
    const data = new FormData(form);
    const parsed = credSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) toast.error(error);
    else if (mode === "signup") toast.success("Account created. Check your email to confirm (if required), then sign in.");
    else toast.success("Welcome back");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Mailcow Provisioner</CardTitle>
          <CardDescription>Manage domains, VPS hosts, and Mailcow deployments.</CardDescription>
        </CardHeader>
        <Tabs defaultValue="signin">
          <TabsList className="mx-6 grid w-auto grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          {(["signin", "signup"] as const).map((mode) => (
            <TabsContent key={mode} value={mode}>
              <form
                onSubmit={(e) => { e.preventDefault(); handle(mode, e.currentTarget); }}
                className="space-y-4"
              >
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-email`}>Email</Label>
                    <Input id={`${mode}-email`} name="email" type="email" required maxLength={255} autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-password`}>Password</Label>
                    <Input id={`${mode}-password`} name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
                  </div>
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                  <Link to="/" className="text-center text-xs text-muted-foreground hover:text-foreground">Back to home</Link>
                </CardFooter>
              </form>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}
