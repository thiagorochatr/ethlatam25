"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RainbowKitCustomConnectButton } from "~~/components/helper";
import { useOutsideClick } from "~~/hooks/helper";

/**
 * Site header
 */
export const Header = () => {
  const pathname = usePathname();
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  const navLinkClass = (path: string) =>
    `px-4 py-2 rounded-md font-medium transition-colors ${
      pathname === path
        ? "bg-[#FFD208] text-[#2D2D2D]"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="sticky lg:static top-0 navbar min-h-0 shrink-0 justify-between z-20 px-0 sm:px-2 bg-white shadow-md">
      <div className="navbar-start">
        <Link href="/" className="text-xl font-bold text-gray-900 px-4">
          🔐 FHE Vesting
        </Link>
      </div>
      
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1 gap-2">
          <li>
            <Link href="/" className={navLinkClass("/")}>
              🏠 Home
            </Link>
          </li>
          <li>
            <Link href="/admin" className={navLinkClass("/admin")}>
              👨‍💼 Admin
            </Link>
          </li>
          <li>
            <Link href="/beneficiary" className={navLinkClass("/beneficiary")}>
              🎁 Beneficiary
            </Link>
          </li>
        </ul>
      </div>

      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
