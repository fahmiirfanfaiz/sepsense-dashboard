"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isJustRegistered = searchParams.get("registered") === "true";

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      await authApi.login({
        email: email.trim().toLowerCase(),
        password,
      });

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err.message || "Gagal masuk. Periksa kembali email dan password Anda."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] px-8 py-10 flex flex-col items-center">
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center">
        <Image
          src="/images/logo.svg"
          alt="Sepsense Logo"
          width={50}
          height={64}
          priority
          className="object-contain"
        />
      </div>

      {/* Heading */}
      <div className="w-full mb-6 text-center">
        <h1 className="text-xl font-bold font-poppins text-[#1A1A2E] tracking-tight">
          Sepsense Dashboard
        </h1>
        <p className="text-sm text-gray-500 font-inter mt-1">
          Masuk ke sistem monitoring klinis sepsis
        </p>
      </div>

      {/* Success banner if redirected from registration */}
      {isJustRegistered && (
        <div
          role="status"
          className="w-full mb-4 flex items-center gap-2.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-inter text-emerald-800"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Akun berhasil dibuat! Silakan masuk dengan akun Anda.</span>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div
          role="alert"
          className="w-full mb-4 flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-inter text-red-700"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        {/* Email Field */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium font-inter text-[#0F172A]"
          >
            Email
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 flex items-center pointer-events-none">
              <Mail className="w-4 h-4 text-[#9CA3AF]" />
            </span>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@rumah-sakit.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              required
              disabled={isLoading}
              className="w-full h-11 pl-10 pr-4 font-inter rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus-visible:border-[#4BB43A] focus-visible:ring-2 focus-visible:ring-[#4BB43A]/20 focus-visible:bg-white"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium font-inter text-[#0F172A]"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#4BB43A] hover:text-[#3A9D2C] font-inter font-medium transition-colors"
            >
              Lupa Password?
            </Link>
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 flex items-center pointer-events-none">
              <Lock className="w-4 h-4 text-[#9CA3AF]" />
            </span>
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              required
              disabled={isLoading}
              className="w-full h-11 pl-10 pr-11 font-inter rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus-visible:border-[#4BB43A] focus-visible:ring-2 focus-visible:ring-[#4BB43A]/20 focus-visible:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 flex items-center text-[#9CA3AF] hover:text-[#6B7280] focus:outline-none transition-colors"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 w-full h-11 font-inter rounded-lg bg-[#4BB43A] text-white text-sm font-semibold tracking-wide transition-all hover:bg-[#3A9D2C] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(75,180,58,0.25)]"
        >
          {isLoading ? "Sedang Masuk..." : "Masuk"}
        </button>

        <div className="text-center text-sm font-inter text-[#6B7280]">
          <p>
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="text-[#4BB43A] hover:text-[#3A9D2C] font-inter transition-colors font-medium"
            >
              Daftar sekarang
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#DDE6F5] px-4 py-12">
      <Suspense fallback={<div className="text-sm font-inter text-gray-500">Memuat...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}