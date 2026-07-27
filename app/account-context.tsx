"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./supabase-client";

const REMEMBER_KEY = "qiuzhao-remember-login";
const ACTIVE_SESSION_KEY = "qiuzhao-active-session";

export type AccountProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_member: boolean;
  membership_started_at: string | null;
  membership_expiry: string | null;
};

export type CloudQuestionProgress = {
  question_id: string;
  user_answer: string | null;
  is_correct: boolean | null;
  attempts: number;
  updated_at: string;
};

type AccountContextValue = {
  session: Session | null;
  profile: AccountProfile | null;
  questionProgress: CloudQuestionProgress[];
  userState: unknown;
  userStateUpdatedAt: string | null;
  completedExamCount: number;
  loading: boolean;
  authOpen: boolean;
  hasAccess: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
  saveQuestionProgress: (
    questionId: string,
    userAnswer: string,
    isCorrect: boolean,
  ) => Promise<void>;
  saveUserState: (payload: unknown) => Promise<string | null>;
  updateFullName: (fullName: string) => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

async function ensureProfile(user: User) {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const { error } = await supabase
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: fullName,
      },
      { onConflict: "id" },
    );
  if (error) throw error;
}

async function recordSuccessfulLogin(user: User) {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      last_sign_in_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

function accessFor() {
  // 收款主体尚未确定，当前版本保持免费开放。会员字段仍会从
  // Supabase 同步，后续接入微信支付时可以直接启用权限判断。
  return true;
}

function AuthDialog({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (remember: boolean) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (!open) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const switchMode = (nextMode: "login" | "register" | "forgot") => {
    setMode(nextMode);
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setCodeSent(false);
    setVerified(false);
    setCooldown(0);
    resetFeedback();
  };

  const closeDialog = async () => {
    if (verified && mode !== "login") {
      await supabase.auth.signOut();
    }
    onClose();
  };

  const sendCode = async () => {
    if (!emailValid) {
      setError("请输入正确的邮箱地址");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: mode === "register",
      },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setCodeSent(true);
    setCooldown(60);
    setMessage("验证码已发送，请查看邮箱。");
  };

  const login = async () => {
    if (!emailValid || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    setBusy(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setBusy(false);
    if (loginError) {
      setError("邮箱或密码不正确");
      return;
    }
    await onAuthenticated(true);
    onClose();
  };

  const verifyEmail = async () => {
    if (!emailValid || !/^\d{6}$/.test(otp)) {
      setError("请输入邮箱和 6 位验证码");
      return;
    }
    setBusy(true);
    setError("");
    const {
      data,
      error: verifyError,
    } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otp,
      type: "email",
    });
    setBusy(false);
    if (verifyError || !data.session) {
      setError(verifyError?.message ?? "验证码无效或已过期");
      return;
    }
    setVerified(true);
    setMessage(
      mode === "register"
        ? "邮箱验证成功，请设置登录密码。"
        : "身份验证成功，请设置新密码。",
    );
  };

  const savePassword = async () => {
    if (!password || password !== confirmPassword) {
      setError(password ? "两次输入的密码不一致" : "请输入新密码");
      return;
    }
    setBusy(true);
    setError("");
    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    });
    setBusy(false);
    if (passwordError) {
      setError(passwordError.message);
      return;
    }
    setVerified(false);
    await onAuthenticated(true);
    onClose();
  };

  const title =
    mode === "login"
      ? "登录学习账号"
      : mode === "register"
        ? verified
          ? "设置登录密码"
          : "注册学习账号"
        : verified
          ? "设置新密码"
          : "找回密码";

  return (
    <div
      className="auth-overlay"
      role="presentation"
      onMouseDown={() => void closeDialog()}
    >
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="登录或注册"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="auth-close"
          type="button"
          onClick={() => void closeDialog()}
        >
          ×
        </button>
        <span className="auth-kicker">ACCOUNT</span>
        <h2>{title}</h2>
        <p>
          {mode === "login"
            ? "登录后，手机与电脑的练习进度和模考记录会自动同步。"
            : verified
              ? "密码强度将按照你在 Supabase 中配置的安全规则校验。"
              : mode === "register"
                ? "先验证邮箱，验证成功后设置登录密码。"
                : "通过邮箱验证码确认身份后，即可设置新密码。"}
        </p>

        {!verified && (
          <label className="auth-field">
            <span>邮箱</span>
            <div className={mode === "login" ? undefined : "auth-code-row"}>
            <input
              type="email"
              inputMode="email"
              value={email}
              autoComplete="email"
              placeholder="请输入邮箱地址"
              onChange={(event) => setEmail(event.target.value)}
            />
              {mode !== "login" && (
                <button
                  type="button"
                  disabled={busy || cooldown > 0 || !emailValid}
                  onClick={() => void sendCode()}
                >
                  {cooldown > 0
                    ? `${cooldown} 秒后重试`
                    : codeSent
                      ? "重新获取"
                      : "获取验证码"}
                </button>
              )}
            </div>
          </label>
        )}

        {mode !== "login" && !verified && (
          <label className="auth-field">
            <span>验证码</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              placeholder="请输入 6 位验证码"
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>
        )}

        {(mode === "login" || verified) && (
          <label className="auth-field">
            <span>{verified ? "新密码" : "密码"}</span>
            <input
              type="password"
              value={password}
              autoComplete={verified ? "new-password" : "current-password"}
              placeholder={verified ? "请输入符合安全要求的新密码" : "请输入密码"}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}

        {verified && (
          <label className="auth-field">
            <span>确认新密码</span>
            <input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              placeholder="请再次输入新密码"
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        )}

        <button
          className="auth-primary"
          type="button"
          disabled={
            busy ||
            (mode === "login"
              ? !emailValid || !password
              : verified
                ? !password || !confirmPassword
                : !emailValid || !/^\d{6}$/.test(otp))
          }
          onClick={() =>
            void (mode === "login"
              ? login()
              : verified
                ? savePassword()
                : verifyEmail())
          }
        >
          {busy
            ? "请稍候…"
            : mode === "login"
              ? "登录"
              : verified
                ? mode === "register"
                  ? "完成注册"
                  : "保存新密码"
                : "验证邮箱"}
        </button>

        {message && <p className="auth-message">{message}</p>}
        {error && <p className="auth-error">{error}</p>}

        <footer className="auth-footer auth-mode-links">
          {mode === "login" ? (
            <>
              <button type="button" onClick={() => switchMode("register")}>
                注册账号
              </button>
              <button type="button" onClick={() => switchMode("forgot")}>
                忘记密码
              </button>
            </>
          ) : (
            <button type="button" onClick={() => switchMode("login")}>
              返回登录
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [questionProgress, setQuestionProgress] = useState<
    CloudQuestionProgress[]
  >([]);
  const [userState, setUserState] = useState<unknown>(null);
  const [userStateUpdatedAt, setUserStateUpdatedAt] = useState<string | null>(
    null,
  );
  const [completedExamCount, setCompletedExamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

  const refreshAccountData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setSession(currentSession);
      if (!currentSession) {
        setProfile(null);
        setQuestionProgress([]);
        setUserState(null);
        setUserStateUpdatedAt(null);
        setCompletedExamCount(0);
        return;
      }

      await ensureProfile(currentSession.user);
      const [profileResult, progressResult, stateResult, examCountResult] =
        await Promise.all([
        supabase
          .from("users")
          .select(
            "id,email,full_name,created_at,last_sign_in_at,is_member,membership_started_at,membership_expiry",
          )
          .eq("id", currentSession.user.id)
          .single(),
        supabase
          .from("user_progress")
          .select("question_id,user_answer,is_correct,attempts,updated_at")
          .order("updated_at", { ascending: false }),
        supabase
          .from("user_state")
          .select("payload,updated_at")
          .eq("user_id", currentSession.user.id)
          .maybeSingle(),
        supabase
          .from("exam_records")
          .select("*", { count: "exact", head: true }),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (progressResult.error) throw progressResult.error;
      if (stateResult.error) throw stateResult.error;
      if (examCountResult.error) throw examCountResult.error;

      setProfile(profileResult.data as AccountProfile);
      setQuestionProgress(
        (progressResult.data ?? []) as CloudQuestionProgress[],
      );
      setUserState(stateResult.data?.payload ?? null);
      setUserStateUpdatedAt(stateResult.data?.updated_at ?? null);
      setCompletedExamCount(examCountResult.count ?? 0);
    } catch (error) {
      console.error("账号云同步失败", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const remembered = window.localStorage.getItem(REMEMBER_KEY) === "1";
      const activeSession =
        window.sessionStorage.getItem(ACTIVE_SESSION_KEY) === "1";
      if (currentSession && !remembered && !activeSession) {
        await supabase.auth.signOut();
      }
      if (active) await refreshAccountData();
    };
    void boot();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        if (active) void refreshAccountData();
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshAccountData]);

  const onAuthenticated = useCallback(
    async (remember: boolean) => {
      window.sessionStorage.setItem(ACTIVE_SESSION_KEY, "1");
      if (remember) window.localStorage.setItem(REMEMBER_KEY, "1");
      else window.localStorage.removeItem(REMEMBER_KEY);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await recordSuccessfulLogin(user);
      await refreshAccountData();
    },
    [refreshAccountData],
  );

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(REMEMBER_KEY);
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setQuestionProgress([]);
    setUserState(null);
    setUserStateUpdatedAt(null);
    setCompletedExamCount(0);
  }, []);

  const saveQuestionProgress = useCallback(
    async (questionId: string, userAnswer: string, isCorrect: boolean) => {
      if (!session) return;
      const existing = questionProgress.find(
        (item) => item.question_id === questionId,
      );
      const row = {
        user_id: session.user.id,
        question_id: questionId,
        user_answer: userAnswer,
        is_correct: isCorrect,
        attempts: (existing?.attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("user_progress")
        .upsert(row, { onConflict: "user_id,question_id" });
      if (error) {
        console.error("单题进度同步失败", error);
        return;
      }
      setQuestionProgress((items) => [
        {
          question_id: row.question_id,
          user_answer: row.user_answer,
          is_correct: row.is_correct,
          attempts: row.attempts,
          updated_at: row.updated_at,
        },
        ...items.filter((item) => item.question_id !== questionId),
      ]);
    },
    [questionProgress, session],
  );

  const saveUserState = useCallback(
    async (payload: unknown) => {
      if (!session) return null;
      const updatedAt = new Date().toISOString();
      const { error } = await supabase.from("user_state").upsert(
        {
          user_id: session.user.id,
          payload,
          updated_at: updatedAt,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        console.error("学习进度同步失败", error);
        return null;
      }
      return updatedAt;
    },
    [session],
  );

  const updateFullName = useCallback(
    async (fullName: string) => {
      if (!session) return;
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (authError) throw authError;
      const { error: profileError } = await supabase
        .from("users")
        .update({ full_name: fullName })
        .eq("id", session.user.id);
      if (profileError) throw profileError;
      await refreshAccountData();
    },
    [refreshAccountData, session],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      session,
      profile,
      questionProgress,
      userState,
      userStateUpdatedAt,
      completedExamCount,
      loading,
      authOpen,
      hasAccess: accessFor(),
      openAuth: () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
      signOut,
      refreshAccountData,
      saveQuestionProgress,
      saveUserState,
      updateFullName,
    }),
    [
      session,
      profile,
      questionProgress,
      userState,
      userStateUpdatedAt,
      completedExamCount,
      loading,
      authOpen,
      signOut,
      refreshAccountData,
      saveQuestionProgress,
      saveUserState,
      updateFullName,
    ],
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
      {authOpen && (
        <AuthDialog
          open
          onClose={() => setAuthOpen(false)}
          onAuthenticated={onAuthenticated}
        />
      )}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount 必须在 AccountProvider 内使用");
  return context;
}
