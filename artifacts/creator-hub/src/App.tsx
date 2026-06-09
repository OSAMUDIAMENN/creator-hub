import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import ProductDownloadPage from "@/pages/product-download";
import DashboardHome from "@/pages/dashboard/index";
import LinksManager from "@/pages/dashboard/links";
import StoreManager from "@/pages/dashboard/store";
import ContentPlanner from "@/pages/dashboard/planner";
import AIAssistant from "@/pages/dashboard/ai";
import AIToolsPage from "@/pages/dashboard/ai-tools";
import AIChatPage from "@/pages/dashboard/ai-chat";
import Analytics from "@/pages/dashboard/analytics";
import Settings from "@/pages/dashboard/settings";
import PricingPage from "@/pages/dashboard/pricing";
import WalletPage from "@/pages/dashboard/wallet";
import TeamsPage from "@/pages/dashboard/teams";
import AdminDashboard from "@/pages/dashboard/admin";
import SocialAccountsPage from "@/pages/dashboard/social";
import CreditsPage from "@/pages/dashboard/credits";
import AIWorkspacePage from "@/pages/dashboard/workspace";
import MarketplacePage from "@/pages/dashboard/marketplace";
import MessagingPage from "@/pages/dashboard/messaging";
import ReferralsPage from "@/pages/dashboard/referrals";
import BookingsPage from "@/pages/dashboard/bookings";
import DiscoverPage from "@/pages/dashboard/discover";
import VerifyPage from "@/pages/dashboard/verify";
import OnboardingPage from "@/pages/dashboard/onboarding";
import PublicProfile from "@/pages/public-profile";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { ErrorBoundary } from "@/components/error-boundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(35 92% 50%)",
    colorForeground: "hsl(222.2 47.4% 11.2%)",
    colorMutedForeground: "hsl(215.4 16.3% 46.9%)",
    colorDanger: "hsl(0 84.2% 60.2%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(214.3 31.8% 91.4%)",
    colorInputForeground: "hsl(222.2 47.4% 11.2%)",
    colorNeutral: "hsl(214.3 31.8% 91.4%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-background rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary font-medium hover:text-primary/90",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive font-medium",
    logoBox: "flex items-center justify-center",
    logoImage: "h-10",
    socialButtonsBlockButton: "border-border hover:bg-accent",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    formFieldInput: "border-input bg-background text-foreground focus:border-ring",
    footerAction: "bg-background",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border border-destructive/20 rounded-md",
    otpCodeFieldInput: "border-input bg-background text-foreground",
    formFieldRow: "mb-4",
    main: "w-full",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <ErrorBoundary>
        <Switch>
          {/* Free-tier routes — no guard needed */}
          <Route path="/dashboard" component={DashboardHome} />
          <Route path="/dashboard/links" component={LinksManager} />
          <Route path="/dashboard/store" component={StoreManager} />
          <Route path="/dashboard/analytics" component={Analytics} />
          <Route path="/dashboard/settings" component={Settings} />
          <Route path="/dashboard/pricing" component={PricingPage} />
          <Route path="/dashboard/wallet" component={WalletPage} />
          <Route path="/dashboard/credits" component={CreditsPage} />
          <Route path="/dashboard/admin" component={AdminDashboard} />
          <Route path="/dashboard/bookings" component={BookingsPage} />
          <Route path="/dashboard/discover" component={DiscoverPage} />
          <Route path="/dashboard/verify" component={VerifyPage} />
          <Route path="/dashboard/marketplace" component={MarketplacePage} />
          <Route path="/dashboard/referrals" component={ReferralsPage} />

          {/* Pro+ routes — AI assistant, chat, tools, planner, workspace, social */}
          <Route path="/dashboard/ai">
            <SubscriptionGuard requiredPlan="pro">
              <AIAssistant />
            </SubscriptionGuard>
          </Route>
          <Route path="/dashboard/ai-chat">
            <SubscriptionGuard requiredPlan="pro">
              <AIChatPage />
            </SubscriptionGuard>
          </Route>
          <Route path="/dashboard/ai-tools">
            <SubscriptionGuard requiredPlan="pro">
              <AIToolsPage />
            </SubscriptionGuard>
          </Route>
          <Route path="/dashboard/workspace">
            <SubscriptionGuard requiredPlan="pro">
              <AIWorkspacePage />
            </SubscriptionGuard>
          </Route>
          <Route path="/dashboard/planner">
            <SubscriptionGuard requiredPlan="pro">
              <ContentPlanner />
            </SubscriptionGuard>
          </Route>
          <Route path="/dashboard/social">
            <SubscriptionGuard requiredPlan="pro">
              <SocialAccountsPage />
            </SubscriptionGuard>
          </Route>

          {/* Business-only routes */}
          <Route path="/dashboard/teams">
            <SubscriptionGuard requiredPlan="business">
              <TeamsPage />
            </SubscriptionGuard>
          </Route>
          <Route path="/dashboard/messaging">
            <SubscriptionGuard requiredPlan="business">
              <MessagingPage />
            </SubscriptionGuard>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </DashboardLayout>
  );
}

function ProtectedDashboard() {
  return (
    <>
      <Show when="signed-in">
        <DashboardRoutes />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to access your CreatorHub account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get started with CreatorHub today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/product/download" component={ProductDownloadPage} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/dashboard" component={ProtectedDashboard} />
          <Route path="/dashboard/*" component={ProtectedDashboard} />
          <Route path="/:username" component={PublicProfile} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <ErrorBoundary>
          <WouterRouter base={basePath}>
            <ClerkProviderWithRoutes />
          </WouterRouter>
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
