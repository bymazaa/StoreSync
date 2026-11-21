import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getViewerUser } from "@/lib/auth/session";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { LandingPage } from "@/components/landing/landing-page";

export const instant = false;

export default async function HomePage() {
  await connection();
  await connectDB();

  const user = await getViewerUser();

  if (user) {
    const permissions = new Set(
      user.rolePermissions.map((entry) => entry.permission)
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

    redirect("/dashboard");
  }

  const userCount = await User.countDocuments({});
  if (userCount === 0) {
    redirect("/setup");
  }

  return <LandingPage />;
}
