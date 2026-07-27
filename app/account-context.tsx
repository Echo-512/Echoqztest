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

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{9,}$/;
const FREE_CUTOFF_UTC = Date.parse("2026-08-02T00:00:00.000Z");
const REMEMBER_KEY = "qiuzhao-remember-login";
const ACTIVE_SESSION_KEY = "qiuzhao-active-session";

export type AccountProfile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_member: boolean;
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
  saveUserState: (payload: unknown) => Promise<void>;
  updateFullName: (fullName: string) => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

async function ensureProfile(user: User) {
  const email = user.email ?? "";
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const { error } = await supabase
    .from("users")
    .upsert({ id: user.id, email, full_name: fullName }, { onConflict: "id" });
  if (error) throw error;
}

async function recordSuccessfulLogin(user: User) {
  const email = user.email ?? "";
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
      last_sign_in_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

function accessFor(profile: AccountProfile | null) {
  if (Date.now() < FREE_CUTOFF_UTC) return true;
  if (!profile) return false;
  if (!profile.is_member) return false;
  if (!profile.membership_expiry) return true;
  return Date.parse(profile.membership_expiry) > Date.now();
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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const passwordValid = PASSWORD_PATTERN.test(password);
  const passwordsMatch = password === confirmPassword;

  const register = async () => {
    if (!passwordValid) {
      setError("密码需至少9位，且包含字母和数字");
      return;
    }
    if (!passwordsMatch) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          typeof window === "undefined" ? undefined : window.location.origin,
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      await onAuthenticated(remember);
      onClose();
      return;
    }
    setMessage("验证邮件已发送。请点击邮件中的确认链接，激活后再登录。");
  };

  const login = async () => {
    setBusy(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (loginError) {
      setError("邮箱或密码不正确");
      return;
    }
    await onAuthenticated(remember);
    onClose();
  };

  const sendResetEmail = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo:
          typeof window === "undefined"
            ? undefined
            : `${window.location.origin}/?reset-password=1`,
      });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage("重置密码邮件已发送，请通过邮件中的链接设置新密码。");
  };

  const switchMode = (nextMode: "login" | "register" | "forgot") => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
  };

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="登录或注册"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="auth-close" type="button" onClick={onClose}>
          ×
        </button>
        <span className="auth-kicker">ACCOUNT</span>
        <h2>
          {mode === "login"
            ? "登录秋招行测"
            : mode === "register"
              ? "创建学习账号"
              : "找回密码"}
        </h2>
        <p>
          {mode === "login"
            ? "登录后，手机与电脑的进度会自动同步。"
            : mode === "register"
              ? "注册后请通过验证邮件激活账号，平台不会公开你的邮箱。"
              : "输入注册邮箱，我们会发送密码重置链接。"}
        </p>

        <label className="auth-field">
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            autoComplete="email"
            placeholder="name@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        {mode !== "forgot" && (
          <label className={`auth-field ${mode === "register" && password && !passwordValid ? "invalid" : ""}`}>
              <span>密码</span>
              <input
                type="password"
                value={password}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "请输入密码" : "至少9位，包含字母和数字"}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "register" && password && !passwordValid && (
                <small>密码需至少9位，且包含字母和数字</small>
              )}
          </label>
        )}

        {mode === "register" && (
            <label className={`auth-field ${confirmPassword && !passwordsMatch ? "invalid" : ""}`}>
              <span>确认密码</span>
              <input
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                placeholder="请再次输入密码"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {confirmPassword && !passwordsMatch && <small>两次输入的密码不一致</small>}
            </label>
        )}

        {mode !== "forgot" && (
            <label className="remember-login">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>自动登录</span>
            </label>
        )}

        <button
          className="auth-primary"
          type="button"
          disabled={
            busy ||
            !email.trim() ||
            (mode === "login" && !password) ||
            (mode === "register" && (!passwordValid || !passwordsMatch))
          }
          onClick={
            mode === "login"
              ? login
              : mode === "register"
                ? register
                : sendResetEmail
          }
        >
          {busy
            ? "请稍候…"
            : mode === "login"
              ? "登录"
              : mode === "register"
                ? "注册并发送验证邮件"
                : "发送重置邮件"}
        </button>

        {message && <p className="auth-message">{message}</p>}
        {error && <p className="auth-error">{error}</p>}

        <footer className="auth-footer">
          {mode !== "login" ? (
            <button type="button" onClick={() => switchMode("login")}>
              返回登录
            </button>
          ) : (
            <>
              <button type="button" onClick={() => switchMode("register")}>
                注册账号
              </button>
              <button type="button" onClick={() => switchMode("forgot")}>
                忘记密码
              </button>
            </>
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
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

  const refreshAccountData = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    setSession(currentSession);
    if (!currentSession) {
      setProfile(null);
      setQuestionProgress([]);
      setUserState(null);
      setLoading(false);
      return;
    }
    await ensureProfile(currentSession.user);
    const [profileResult, progressResult, stateResult] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id,email,full_name,created_at,last_sign_in_at,is_member,membership_expiry",
        )
        .eq("id", currentSession.user.id)
        .single(),
      supabase
        .from("user_progress")
        .select("question_id,user_answer,is_correct,attempts,updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("user_state")
        .select("payload")
        .eq("user_id", currentSession.user.id)
        .maybeSingle(),
    ]);
    if (profileResult.data) setProfile(profileResult.data as AccountProfile);
    setQuestionProgress(
      (progressResult.data ?? []) as CloudQuestionProgress[],
    );
    setUserState(stateResult.data?.payload ?? null);
    setLoading(false);
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
      if (error) return;
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
      if (!session) return;
      await supabase.from("user_state").upsert(
        {
          user_id: session.user.id,
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    },
    [session],
  );

  const updateFullName = useCallback(
    async (fullName: string) => {
      if (!session) return;
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      await supabase
        .from("users")
        .update({ full_name: fullName })
        .eq("id", session.user.id);
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
      loading,
      authOpen,
      hasAccess: accessFor(profile),
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
