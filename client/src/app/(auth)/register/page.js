"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { User, Mail, Lock, Eye, EyeOff, ChevronDown } from "lucide-react";

// TODO: sesuaikan dengan role yang valid di backend kamu
const ROLES = [
  { value: "apoteker", label: "Apoteker" },
  { value: "dokter", label: "Dokter" },
  { value: "perawat", label: "Perawat" },
];

const inputClass =
  "w-full h-11 pl-10 font-inter rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus-visible:border-[#3B6FE8] focus-visible:ring-2 focus-visible:ring-[#3B6FE8]/20 focus-visible:bg-white";

const labelClass = "text-[14px] font-medium font-inter text-[#0F172A]";
const iconClass = "w-4 h-4 text-[#9CA3AF]";
const toggleClass =
  "absolute right-3.5 flex items-center text-[#9CA3AF] hover:text-[#6B7280] transition-colors";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsLoading(true);
    try {
      const { confirmPassword, ...payload } = form; 
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registrasi gagal. Silakan coba lagi.");
        return;
      }

      router.push("/login?registered=true");
    } catch (err) {
      console.error(err);
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#DDE6F5] px-4 py-12">
      <div className="w-full max-w-119.5 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] px-10 py-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-5 flex items-center justify-center">
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
        <div className="w-full mb-2 text-center">
          <h1 className="text-[18px] font-poppins font-bold text-[#1A1A2E] mb-1 tracking-tight">
            Daftar Akun Baru
          </h1>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="w-full mb-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-inter text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Nama Lengkap */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className={labelClass}>
              Nama Lengkap
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 flex items-center pointer-events-none">
                <User className={iconClass} />
              </span>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Masukkan nama lengkap"
                value={form.name}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`${inputClass} pr-4`}
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 flex items-center pointer-events-none">
                <Mail className={iconClass} />
              </span>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Masukkan email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`${inputClass} pr-4`}
              />
            </div>
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className={labelClass}>
              Role
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 flex items-center pointer-events-none">
                <User className={iconClass} />
              </span>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`${inputClass} pr-10 appearance-none disabled:opacity-60 ${
                  form.role ? "text-[#111827]" : "text-[#9CA3AF]"
                }`}
              >
                <option value="" disabled>
                  Pilih role
                </option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value} className="text-[#111827]">
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="absolute right-3.5 flex items-center pointer-events-none">
                <ChevronDown className={iconClass} />
              </span>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 flex items-center pointer-events-none">
                <Lock className={iconClass} />
              </span>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                disabled={isLoading}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={toggleClass}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Konfirmasi Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className={labelClass}>
              Konfirmasi Password
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 flex items-center pointer-events-none">
                <Lock className={iconClass} />
              </span>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Ulangi password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className={toggleClass}
                aria-label={
                  showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"
                }
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full h-11 font-inter rounded-lg bg-[#4BB43A] text-white text-sm font-semibold tracking-wide transition-all hover:bg-[#3A9D2C] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(59,111,232,0.35)]"
          >
            {isLoading ? "Mendaftar..." : "Daftar"}
          </button>

          <div className="text-center text-sm font-inter text-[#6B7280]">
            <p>
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="text-[#4BB43A] hover:text-[#3A9D2C] transition-colors font-medium"
              >
                Masuk
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}