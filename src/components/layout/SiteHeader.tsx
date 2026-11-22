import { UserMenu } from "@/features/auth/UserMenu";
import { SubscribeButton } from "@/features/subscription/SubscribeButton";

import { HeaderSearch, MobileSearch } from "./HeaderSearch";
import { Logo } from "./Logo";
import { MainNav } from "./MainNav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 h-[var(--header-height)] border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <MainNav className="ml-4 hidden md:block" />
        <div className="ml-auto flex items-center gap-2">
          <HeaderSearch className="hidden w-56 lg:block" />
          <div className="lg:hidden">
            <MobileSearch />
          </div>
          <SubscribeButton
            label="Subscribe"
            labelClassName="sr-only sm:not-sr-only"
            className="max-sm:size-10 max-sm:px-0"
          />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
