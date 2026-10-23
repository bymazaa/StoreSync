import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getViewerUser } from "@/lib/auth/session";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { connection } from "next/server";

// Force dynamic rendering - this page depends on session state and DB
export const instant = false;

export default async function LoginPage() {
  // Force dynamic by accessing connection
  await connection();
  
  await connectDB();
  const user = await getViewerUser();
  if (user) redirect("/");
  
  const userCount = await User.countDocuments({});
  if (userCount === 0) redirect("/setup");
  
  return (
    <div className="w-full max-w-md">
      <AuthForm mode="login" />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Developed by{" "}
        <a href="https://bymaza.me" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
          bymaza.me
        </a>
      </p>
    </div>
  );
}
