
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Dashboard } from "@/components/dashboard/dashboard";
import { getViewerUser } from "@/lib/auth/session";

export const instant = false;

export default function Home() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-background"
          aria-busy="true"
          aria-label="Loading dashboard"
        />
      }
    >
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();
  const user = await getViewerUser();

  const permissions = new Set(
    user?.rolePermissions.map((entry) => entry.permission) ?? []
  );

  if (!permissions.has("VIEW_REPORTS")) {
    if (permissions.has("CREATE_SALES")) {
      redirect("/sales");
    }

    if (permissions.has("CREATE_PURCHASES")) {
      redirect("/purchases");
    }

    if (permissions.has("MANAGE_PRODUCTS")) {
      redirect("/products");
    }

    redirect("/guide");
  }

  return <Dashboard />;
}
