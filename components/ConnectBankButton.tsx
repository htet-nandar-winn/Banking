"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import { createDemoBankAccount } from "@/lib/actions/demo-bank.actions";
import { DEMO_ACCOUNT_TYPES, DEMO_INSTITUTIONS } from "@/lib/demo-bank";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

const ConnectBankButton = ({
  user,
  variant = "primary",
}: {
  user: User;
  variant?: "primary" | "ghost" | "default";
}) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [institution, setInstitution] = useState<string>(DEMO_INSTITUTIONS[0].name);
  const [accountType, setAccountType] = useState<string>(DEMO_ACCOUNT_TYPES[0].value);
  const [accountName, setAccountName] = useState("Everyday checking");
  const [balance, setBalance] = useState("2500");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await createDemoBankAccount({
        userId: user.$id,
        email: user.email,
        institutionName: institution,
        accountName,
        accountType,
        balance,
      });

      if (!result?.success) {
        setError(result?.error ?? "Could not create the account.");
        return;
      }

      setOpen(false);
      router.refresh();
      router.push("/my-banks");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create the account."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const trigger =
    variant === "ghost" ? (
      <Button className="plaidlink-ghost">
        <Image src="/icons/connect-bank.svg" alt="connect bank" width={24} height={24} />
        <p className="hidden text-[16px] font-semibold text-black-2 xl:block">
          Connect bank
        </p>
      </Button>
    ) : variant === "default" ? (
      <Button className="plaidlink-default">
        <Image src="/icons/connect-bank.svg" alt="connect bank" width={24} height={24} />
        <p className="text-[16px] font-semibold text-black-2">Connect bank</p>
      </Button>
    ) : (
      <Button className="plaidlink-primary">Connect bank</Button>
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>

      <SheetContent side="right" className="w-full bg-white sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-20 font-semibold text-gray-900">
            Add a bank account
          </SheetTitle>
          <SheetDescription className="text-14 text-gray-600">
            This project runs in demo mode, so the account is created locally in
            Appwrite. Transfers between your own accounts work immediately.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="institution" className="text-14 font-medium text-gray-700">
              Bank
            </Label>
            <Select value={institution} onValueChange={setInstitution}>
              <SelectTrigger id="institution" className="input-class">
                <SelectValue placeholder="Select a bank" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {DEMO_INSTITUTIONS.map((item) => (
                  <SelectItem key={item.id} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="accountType" className="text-14 font-medium text-gray-700">
              Account type
            </Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger id="accountType" className="input-class">
                <SelectValue placeholder="Select an account type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {DEMO_ACCOUNT_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="accountName" className="text-14 font-medium text-gray-700">
              Account name
            </Label>
            <Input
              id="accountName"
              className="input-class"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Everyday checking"
              maxLength={60}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="balance" className="text-14 font-medium text-gray-700">
              Starting balance (USD)
            </Label>
            <Input
              id="balance"
              className="input-class"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="2500"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isLoading} className="form-btn">
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" /> &nbsp; Creating...
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ConnectBankButton;
