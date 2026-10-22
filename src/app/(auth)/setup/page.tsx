import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { connection } from "next/server";

// The setup gate depends on the current owner count in this shop's database.
export const instant = false;

export default async function SetupPage() {
  // Force dynamic rendering by accessing connection
  await connection();
  
  await connectDB();
  const userCount = await User.countDocuments({});
  if (userCount !== 0) redirect("/login");
  return <AuthForm mode="setup" />;
}
