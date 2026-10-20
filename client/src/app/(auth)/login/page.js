"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#DDE6F5] px-4 py-12">
      <div className="w-full max-w-119.5 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] px-10 py-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center">
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
        <div className="w-full -mt-3  mb-2 text-center">
          <h1 className="text-[20px] font-poppins font-bold text-[#1A1A2E] mb-1 tracking-tight">
            Sepsense Dashboard
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[14px] font-medium font-inter text-[#0F172A]"
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
                placeholder="Masukkan email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full h-11 pl-10 font-inter pr-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#3B6FE8] focus:ring-2 focus:ring-[#3B6FE8]/20 focus:bg-white"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-inter font-medium text-[#374151]"
              >
                Password
              </label>
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
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full font-inter h-11 pl-10 pr-11 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#3B6FE8] focus:ring-2 focus:ring-[#3B6FE8]/20 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 flex items-center text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="flex justify-end mt-1">
              <Link
                href="/forgot-password"
                className="text-xs text-[#4BB43A] hover:text-[#3A9D2C] font-inter transition-colors font-medium"
              >
                Lupa Password?
              </Link>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full h-11 font-inter rounded-lg bg-[#4BB43A] text-white text-sm font-semibold tracking-wide transition-all hover:bg-[#3A9D2C] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(59,111,232,0.35)]"
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
    </div>
  );
}