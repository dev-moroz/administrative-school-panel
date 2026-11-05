import { Suspense } from "react";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { LoginForm } from "@/features/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Reads the env at request time, so the demo credentials are not baked into the build.
async function LoginFormWithDemo() {
  await connection();
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  return <LoginForm demo={email && password ? { email, password } : undefined} />;
}

export default function LoginPage() {
  const t = useTranslations("Login");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginFormWithDemo />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
