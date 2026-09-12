import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, UserX } from "lucide-react";

interface AuthProps {
  redirectAfterAuth?: string;
}

type Step = "signIn" | { email: string };

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

export default function PulseAnalyticsSignIn({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [step, setStep] = useState<Step>("signIn");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const resetToSignIn = () => {
    setStep("signIn");
    setOtp(Array(6).fill(""));
    setError(null);
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const submitOtp = async (code: string, emailForStep: string) => {
    if (code.length !== 6) return;
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", emailForStep);
      formData.set("code", code);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp(Array(6).fill(""));
      otpRefs.current[0]?.focus();
    }
  };

  const handleOtpChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otp];
    next[index] = value;
    setOtp(next);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const code = next.join("");
    if (code.length === 6 && typeof step === "object") {
      submitOtp(code, step.email);
    }
  };

  const handleOtpKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (err) {
      console.error("Guest login error:", err);
      setError(
        `Failed to sign in as guest: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  const otpValue = otp.join("");

  return (
    <div className="pa-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

        .pa-root {
          --bg-0: #ffffff;
          --bg-1: #eaf6ff;
          --violet: #2f80ed;
          --blue: #2d9cdb;
          --cyan: #56ccf2;
          --ink: #10233d;
          --ink-dim: #5b7290;
          --glass-border: rgba(45,156,219,0.22);
          --glass-fill: rgba(86,204,242,0.10);

          background: linear-gradient(180deg, var(--bg-0), var(--bg-1) 70%);
          color: var(--ink);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .pa-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(60% 50% at 80% 0%, rgba(86,204,242,0.28), transparent 65%),
            radial-gradient(50% 45% at 10% 15%, rgba(47,128,237,0.14), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .pa-auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          border: 1px solid var(--glass-border);
          border-radius: 22px;
          box-shadow: 0 40px 90px -25px rgba(45,156,219,0.3);
          overflow: hidden;
        }

        .pa-auth-body {
          padding: 40px 36px 32px;
          text-align: center;
        }

        .pa-auth-logo {
          width: 56px; height: 56px; border-radius: 16px;
          margin: 0 auto 22px;
          background: linear-gradient(135deg, var(--blue), var(--violet));
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700; font-size: 24px; color: white;
          box-shadow: 0 10px 24px -6px rgba(47,128,237,0.5);
          cursor: pointer;
          border: none;
        }
        .pa-auth-logo:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

        .pa-auth-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 24px;
          letter-spacing: -0.01em;
          margin-bottom: 8px;
        }

        .pa-auth-sub {
          font-size: 14.5px;
          color: var(--ink-dim);
          margin-bottom: 26px;
        }

        .pa-auth-row {
          display: flex;
          gap: 10px;
        }

        .pa-auth-input-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--glass-fill);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 0 14px;
        }
        .pa-auth-input-wrap:focus-within {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px rgba(45,156,219,0.15);
        }
        .pa-auth-input-wrap svg { color: var(--ink-dim); flex-shrink: 0; }

        .pa-auth-input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          color: var(--ink);
          padding: 13px 0;
        }
        .pa-auth-input::placeholder { color: #9fb0c6; }
        .pa-auth-input:disabled { opacity: 0.6; }

        .pa-auth-submit {
          display: flex; align-items: center; justify-content: center;
          width: 46px; height: 46px; flex-shrink: 0;
          border: none; border-radius: 12px;
          background: linear-gradient(135deg, var(--blue), var(--violet));
          color: white; cursor: pointer;
          box-shadow: 0 10px 22px -8px rgba(47,128,237,0.55);
          transition: transform 0.2s ease, filter 0.2s ease;
        }
        .pa-auth-submit:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
        .pa-auth-submit:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
        .pa-auth-submit:disabled { opacity: 0.65; cursor: not-allowed; }

        .pa-auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 22px 0;
        }
        .pa-auth-divider::before,
        .pa-auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--glass-border);
        }
        .pa-auth-divider span {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--ink-dim);
        }

        .pa-auth-guest {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14.5px;
          color: var(--ink);
          background: var(--glass-fill);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 13px 18px;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }
        .pa-auth-guest:hover:not(:disabled) {
          background: rgba(86,204,242,0.16);
          border-color: rgba(45,156,219,0.35);
          transform: translateY(-1px);
        }
        .pa-auth-guest:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
        .pa-auth-guest:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

        .pa-auth-verify {
          background: linear-gradient(135deg, var(--blue), var(--violet));
          color: white;
          border: none;
          margin-top: 4px;
        }
        .pa-auth-verify:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--blue), var(--violet));
          filter: brightness(1.06);
        }

        .pa-otp-row {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .pa-otp-input {
          width: 42px; height: 50px;
          text-align: center;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 20px; font-weight: 600;
          color: var(--ink);
          background: var(--glass-fill);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .pa-otp-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px rgba(45,156,219,0.15);
        }
        .pa-otp-input:disabled { opacity: 0.6; }

        .pa-auth-error {
          font-size: 13px;
          color: #e0533d;
          margin-top: 10px;
        }
        .pa-auth-error-center { text-align: center; }

        .pa-auth-resend {
          font-size: 13.5px;
          color: var(--ink-dim);
          margin: 16px 0 20px;
        }

        .pa-auth-link {
          border: none;
          background: none;
          padding: 0;
          font: inherit;
          font-weight: 600;
          color: var(--blue);
          cursor: pointer;
        }
        .pa-auth-link:hover { text-decoration: underline; }
        .pa-auth-link:disabled { opacity: 0.6; cursor: not-allowed; }

        .pa-auth-link-block {
          display: block;
          width: 100%;
          margin-top: 14px;
          color: var(--ink-dim);
          font-size: 14px;
        }

        .pa-spin {
          animation: pa-spin 0.8s linear infinite;
        }
        @keyframes pa-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pa-spin { animation: none; }
        }

        .pa-auth-footer {
          padding: 16px 24px;
          background: var(--glass-fill);
          border-top: 1px solid var(--glass-border);
          text-align: center;
          font-size: 13px;
          color: var(--ink-dim);
        }
        .pa-auth-footer a {
          color: var(--blue);
          font-weight: 600;
          text-decoration: underline;
        }
      `}</style>

      <div className="pa-auth-card">
        <div className="pa-auth-body">
          <button
            type="button"
            className="pa-auth-logo"
            onClick={() => navigate("/")}
            aria-label="Go to home"
          >
            P
          </button>

          {step === "signIn" ? (
            <>
              <h1 className="pa-auth-title">Get Started</h1>
              <p className="pa-auth-sub">Enter your email to log in or sign up</p>

              <form onSubmit={handleEmailSubmit}>
                <div className="pa-auth-row">
                  <div className="pa-auth-input-wrap">
                    <Mail size={17} strokeWidth={1.75} />
                    <input
                      className="pa-auth-input"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <button
                    className="pa-auth-submit"
                    type="submit"
                    aria-label="Continue"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="pa-spin" />
                    ) : (
                      <ArrowRight size={18} />
                    )}
                  </button>
                </div>
                {error && <p className="pa-auth-error">{error}</p>}
              </form>

              <div className="pa-auth-divider">
                <span>OR</span>
              </div>

              <button
                type="button"
                className="pa-auth-guest"
                onClick={handleGuestLogin}
                disabled={isLoading}
              >
                <UserX size={17} strokeWidth={1.75} />
                Continue as Guest
              </button>
            </>
          ) : (
            <>
              <h1 className="pa-auth-title">Check your email</h1>
              <p className="pa-auth-sub">We&apos;ve sent a code to {step.email}</p>

              <div className="pa-otp-row">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    className="pa-otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    disabled={isLoading}
                  />
                ))}
              </div>

              {error && <p className="pa-auth-error pa-auth-error-center">{error}</p>}

              <p className="pa-auth-resend">
                Didn&apos;t receive a code?{" "}
                <button type="button" className="pa-auth-link" onClick={resetToSignIn}>
                  Try again
                </button>
              </p>

              <button
                type="button"
                className="pa-auth-guest pa-auth-verify"
                onClick={() => submitOtp(otpValue, step.email)}
                disabled={isLoading || otpValue.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={17} className="pa-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify code
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <button
                type="button"
                className="pa-auth-link pa-auth-link-block"
                onClick={resetToSignIn}
                disabled={isLoading}
              >
                Use different email
              </button>
            </>
          )}
        </div>

        <div className="pa-auth-footer">
          Secured by{" "}
          <a href="" target="_blank" rel="noopener noreferrer">
            Pulse Analytics
          </a>
        </div>
      </div>
    </div>
  );
}