"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
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
                <div className="w-full mb-6 text-center">
                    <h1 className="text-2xl font-bold text-[#1A1A2E] mb-1 tracking-tight">
                       Sepsense Dashboard
                    </h1>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                    {/* Email Field */}
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="email"
                            className="text-sm font-medium text-[#374151]"
                        >
                            Email
                        </label>
                        <div className="relative flex items-center">
                            <span className="absolute left-3.5 flex items-center pointer-events-none">
                                <Mail className="w-4 h-4 text-[#9CA3AF]" />
                            </span>
                            <input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#3B6FE8] focus:ring-2 focus:ring-[#3B6FE8]/20 focus:bg-white"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium text-[#374151]"
                            >
                                Password
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-xs text-[#3B6FE8] hover:text-[#2855C0] transition-colors font-medium"
                            >
                                Forgot Password?
                            </Link>
                        </div>
                        <div className="relative flex items-center">
                            <span className="absolute left-3.5 flex items-center pointer-events-none">
                                <Lock className="w-4 h-4 text-[#9CA3AF]" />
                            </span>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full h-11 pl-10 pr-11 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#3B6FE8] focus:ring-2 focus:ring-[#3B6FE8]/20 focus:bg-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3.5 flex items-center text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                                aria-label={showPassword ? "Hide password" : "Show password"}
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
                        className="mt-2 w-full h-11 rounded-lg bg-[#3B6FE8] text-white text-sm font-semibold tracking-wide transition-all hover:bg-[#2855C0] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(59,111,232,0.35)]"
                    >
                        {isLoading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    )
}
