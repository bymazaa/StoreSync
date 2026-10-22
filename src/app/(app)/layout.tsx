
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import connectDB from "@/lib/db";
import { User, Settings } from "@/models";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-background"
          aria-busy="true"
          aria-label="Loading workspace"
        />
      }
    >
      <AuthenticatedContent>{children}</AuthenticatedContent>
    </Suspense>
  );
}

async function AuthenticatedContent({
  children,
}: {
  children: ReactNode;
}) {
  await connectDB();

  const user = await getCurrentUser();

  if (!user) {
    const userCount = await User.countDocuments({});
    redirect(userCount === 0 ? "/setup" : "/login");
  }

  const settings = await Settings.findById("shop")
    .select("shopName countryCode currencyCode locale timezone")
    .lean();

  return (
    <AppShell
      user={user}
      shopName={settings?.shopName ?? "My Grocery Shop"}
      countryCode={settings?.countryCode ?? "US"}
      currencyCode={settings?.currencyCode ?? "USD"}
      locale={settings?.locale ?? "en-US"}
      timezone={settings?.timezone ?? "America/New_York"}
      permissions={user.rolePermissions.map(
        (entry) => entry.permission
      )}
    >
      {children}
    </AppShell>
  );
}
