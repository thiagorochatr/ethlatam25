import Link from "next/link";
import { FHECounterDemo } from "./_components/FHECounterDemo";

export default function Home() {
  return (
    <div className="flex flex-col gap-8 items-center sm:items-start w-full px-3 md:px-0">
      {/* Hero Section */}
      <div className="w-full bg-gradient-to-r from-[#FFD208] to-[#A38025] p-8 rounded-lg shadow-xl text-center">
        <h1 className="text-4xl font-bold text-[#2D2D2D] mb-4">
          🔐 Confidential Token Vesting Platform
        </h1>
        <p className="text-lg text-[#2D2D2D] mb-6">
          Create and manage encrypted token vesting schedules using Fully Homomorphic Encryption (FHE)
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/admin"
            className="bg-[#2D2D2D] text-white px-6 py-3 rounded-lg font-semibold hover:bg-black transition-all"
          >
            👨‍💼 Admin Panel
          </Link>
          <Link
            href="/beneficiary"
            className="bg-white text-[#2D2D2D] px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all"
          >
            🎁 Beneficiary Portal
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-3">🔒 Encrypted Balances</h3>
          <p className="text-gray-700">
            Token amounts are fully encrypted using FHE. No one can see the vested amounts except the beneficiary.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-3">⏰ Cliff & Vesting</h3>
          <p className="text-gray-700">
            Set a cliff period (e.g., 2 min) before tokens start vesting linearly over time (e.g., 5 min total).
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-3">📦 Batch Creation</h3>
          <p className="text-gray-700">
            Create multiple vesting schedules in a single transaction for efficient token distribution.
          </p>
        </div>
      </div>

      {/* FHE Counter Demo */}
      <div className="w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">🧮 FHE Counter Demo</h2>
        <FHECounterDemo />
      </div>
    </div>
  );
}
