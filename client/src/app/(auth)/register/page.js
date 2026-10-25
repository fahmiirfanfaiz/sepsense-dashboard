"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { User, Mail, Lock, Eye, EyeOff, ChevronDown, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";

const ROLES = [
  { value: "dokter", label: "Dokter" },
  { value: "perawat", label: "Perawat" },
  { value: "apoteker", label: "Apoteker" },
];

const inputClass =
  "w-full h-11 pl-10 font-inter rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus-visible:border-[#4BB43A] focus-visible:ring-2 focus-visible:ring-[#4BB43A]/20 focus-visible:bg-white";

const labelClass = "text-sm font-medium font-inter text-[#0F172A]";
const iconClass = "w-4 h-4 text-[#9CA3AF]";
const toggleClass =
  "absolute right-3.5 flex items-center text-[#9CA3AF] hover:text-[#6B7280] focus:outline-none transition-colors";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage("");
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");
    setFieldErrors({});

    // Client-side validations
    if (form.name.trim().length < 2) {
      setFieldErrors((prev) => ({ ...prev, name: "Nama minimal 2 karakter." }));
      return;
    }
    if (!form.role) {
      setFieldErrors((prev) => ({ ...prev, role: "Silakan pilih role." }));
      return;
    }
    if (form.password.length < 8) {
      setFieldErrors((prev) => ({ ...prev, password: "Password minimal 8 karakter." }));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: "Konfirmasi password tidak cocok.",
      }));
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
      });

      // Redirect ke login dengan query parameter untuk menampilkan notifikasi sukses
      router.push("/login?registered=true");
    } catch (err) {
      console.error(err);
      if (err.errors && Array.isArray(err.errors)) {
        const errorsMap = {};
        err.errors.forEach((item) => {
          if (item.field) errorsMap[item.field] = item.message;
        });
        setFieldErrors(errorsMap);
      }
      setErrorMessage(err.message || "Registrasi gagal. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#DDE6F5] px-4 py-12">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] px-8 py-10 flex flex-col items-center">
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
        <div className="w-full mb-4 text-center">
          <h1 className="text-xl font-bold font-poppins text-[#1A1A2E] tracking-tight">
            Daftar Akun Baru
          </h1>
          <p className="text-sm text-gray-500 font-inter mt-1">
            Bergabung dengan platform pemantauan Sepsense
          </p>
        </div>

        {/* Global Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="w-full mb-4 flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-inter text-red-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
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
                placeholder="cth. dr. Budi Santoso, Sp.A"
                value={form.name}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`${inputClass} pr-4 ${
                  fieldErrors.name ? "border-red-400 focus-visible:ring-red-200" : ""
                }`}
              />
            </div>
            {fieldErrors.name && (
              <span className="text-xs text-red-600 font-inter mt-0.5">
                {fieldErrors.name}
              </span>
            )}
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
                placeholder="nama@rumah-sakit.com"
                value={form.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`${inputClass} pr-4 ${
                  fieldErrors.email ? "border-red-400 focus-visible:ring-red-200" : ""
                }`}
              />
            </div>
            {fieldErrors.email && (
              <span className="text-xs text-red-600 font-inter mt-0.5">
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className={labelClass}>
              Peran Klinis (Role)
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
                className={`${inputClass} pr-10 appearance-none disabled:opacity-60 cursor-pointer ${
                  form.role ? "text-[#111827]" : "text-[#9CA3AF]"
                } ${
                  fieldErrors.role ? "border-red-400 focus-visible:ring-red-200" : ""
                }`}
              >
                <option value="" disabled>
                  Pilih peran klinis
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
            {fieldErrors.role && (
              <span className="text-xs text-red-600 font-inter mt-0.5">
                {fieldErrors.role}
              </span>
            )}
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
                className={`${inputClass} pr-11 ${
                  fieldErrors.password ? "border-red-400 focus-visible:ring-red-200" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={toggleClass}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="text-xs text-red-600 font-inter mt-0.5">
                {fieldErrors.password}
              </span>
            )}
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
                className={`${inputClass} pr-11 ${
                  fieldErrors.confirmPassword ? "border-red-400 focus-visible:ring-red-200" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className={toggleClass}
                aria-label={
                  showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <span className="text-xs text-red-600 font-inter mt-0.5">
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full h-11 font-inter rounded-lg bg-[#4BB43A] text-white text-sm font-semibold tracking-wide transition-all hover:bg-[#3A9D2C] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(75,180,58,0.25)]"
          >
            {isLoading ? "Mendaftarkan Akun..." : "Daftar"}
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